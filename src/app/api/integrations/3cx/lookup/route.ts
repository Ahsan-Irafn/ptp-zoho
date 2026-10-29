import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizePhone } from '@/lib/utils/normalization';

// In-memory rate limiting map for lookup endpoint: IP -> timestamp[]
const lookupRateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string, limit = 120, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = lookupRateLimitMap.get(ip) || [];
  const validTimestamps = timestamps.filter(t => t > now - windowMs);
  if (validTimestamps.length >= limit) {
    return false;
  }
  validTimestamps.push(now);
  lookupRateLimitMap.set(ip, validTimestamps);
  return true;
}

/**
 * 3CX Contact Lookup Endpoint (GetContactByNumber Scenario)
 * GET /api/integrations/3cx/lookup?number=[Number]&extension=[AgentExtension]
 */
export async function GET(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown-ip';

  // 1. Rate Limiting to prevent brute-force phone enumeration
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded for contact lookup.'
    }, { status: 429 });
  }

  const org = db.organizations.findFirst();
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 500 });
  }

  // 2. Authenticate Request
  const authHeader = req.headers.get('authorization');
  const apiKeyHeader = req.headers.get('x-api-key');
  const queryApiKey = req.nextUrl.searchParams.get('api_key');

  let providedApiKey = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedApiKey = authHeader.substring(7).trim();
  } else if (apiKeyHeader) {
    providedApiKey = apiKeyHeader.trim();
  } else if (queryApiKey) {
    providedApiKey = queryApiKey.trim();
  }

  const conn = db.integrations.findByProvider(org.id, 'three_cx');
  const expectedApiKey = conn?.config?.api_key || process.env.PTP_3CX_API_KEY || 'ptp_3cx_sec_demo_key_2026';

  if (!providedApiKey || providedApiKey !== expectedApiKey) {
    // Record security audit event
    db.auditEvents.create({
      organization_id: org.id,
      actor_name: '3CX Security Monitor',
      action: '3cx_lookup_auth_failed',
      target_type: 'integration',
      target_id: conn?.id || 'three_cx',
      ip_address: clientIp,
      details: {
        provided_header: !!authHeader || !!apiKeyHeader,
        client_ip: clientIp,
        error: 'Invalid or missing API key',
      }
    });

    if (conn) {
      db.integrations.upsert(org.id, 'three_cx', {
        status: 'authentication_failed',
        last_error: `Authentication failed from IP ${clientIp}`,
        failure_count: (conn.failure_count || 0) + 1,
      });
    }

    return NextResponse.json({
      error: 'Unauthorized',
      message: 'Invalid or missing 3CX integration API key'
    }, { status: 401 });
  }

  // 3. Extract and normalize phone query parameter
  const rawNumber = req.nextUrl.searchParams.get('number') || '';
  const agentExtension = req.nextUrl.searchParams.get('extension') || '';

  if (!rawNumber.trim()) {
    return NextResponse.json({
      error: 'Bad Request',
      message: 'Parameter "number" is required for contact lookup'
    }, { status: 400 });
  }

  const normalizedQuery = normalizePhone(rawNumber);
  const rawDigits = rawNumber.replace(/\D/g, '');

  // 4. Search contacts
  const allContacts = db.contacts.findMany(org.id);
  const matchedContacts = allContacts.filter(c => {
    if (!c.phone && !c.phone_normalized) return false;
    
    // Exact match on normalized phone (+61...)
    if (c.phone_normalized && c.phone_normalized === normalizedQuery) return true;
    
    // Match normalized against raw contact phone
    if (c.phone && normalizePhone(c.phone) === normalizedQuery) return true;

    // Match on raw digits suffix (e.g. 9 or 10 digits match to handle local vs international)
    const cDigits = (c.phone || '').replace(/\D/g, '');
    if (rawDigits.length >= 8 && cDigits.length >= 8) {
      if (rawDigits.endsWith(cDigits.slice(-8)) || cDigits.endsWith(rawDigits.slice(-8))) {
        return true;
      }
    }

    return false;
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin || 'https://crm.pracpathways.com.au';

  // 5. Build 3CX-compatible JSON response
  // 3CX CRM template expects contacts array with id, firstname, lastname, company, email, phone, contact_url
  const contactsPayload = matchedContacts.map(c => {
    const assignedAgent = c.assigned_agent_id ? db.profiles.findById(c.assigned_agent_id) : undefined;
    
    return {
      id: c.id,
      firstname: c.first_name || c.full_name.split(' ')[0] || 'Lead',
      lastname: c.last_name || c.full_name.split(' ').slice(1).join(' ') || '',
      company: 'Practical Training Pathways',
      email: c.email,
      phone: c.phone || c.phone_normalized || rawNumber,
      // Screen-pop link: requires login and normal authentication; does not bypass CRM security
      contact_url: `${appUrl}/contacts/${c.id}`,
      assigned_agent: assignedAgent ? assignedAgent.full_name : 'Unassigned',
      course_interest: c.course_interest || '',
      lifecycle_stage: c.lifecycle_stage,
      lead_status: c.lead_status,
      do_not_call: c.do_not_call || false,
    };
  });

  // Update integration verification & activity timestamps
  const now = new Date().toISOString();
  db.integrations.upsert(org.id, 'three_cx', {
    status: 'connected_and_verified',
    last_verified_at: now,
    last_activity_at: now,
    last_error: undefined,
    failure_count: 0,
  });

  return NextResponse.json({
    success: true,
    count: contactsPayload.length,
    ambiguous: contactsPayload.length > 1,
    query_number: rawNumber,
    normalized_number: normalizedQuery,
    agent_extension: agentExtension,
    contacts: contactsPayload,
    // First match convenience properties for templates that map directly from root object
    ...(contactsPayload.length > 0 ? {
      id: contactsPayload[0].id,
      firstname: contactsPayload[0].firstname,
      lastname: contactsPayload[0].lastname,
      company: contactsPayload[0].company,
      email: contactsPayload[0].email,
      phone: contactsPayload[0].phone,
      contact_url: contactsPayload[0].contact_url,
    } : {})
  }, {
    status: contactsPayload.length > 0 ? 200 : 404,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    }
  });
}
