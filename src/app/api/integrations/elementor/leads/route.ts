import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { LeadProcessor } from '@/lib/services/lead-processor';
import { ElementorFieldMappings } from '@/types/crm';

const MAX_PAYLOAD_BYTES = 512 * 1024; // 512KB request-size limit
const MAX_TIMESTAMP_DRIFT_SEC = 600; // 10 minutes clock-skew & replay tolerance

// In-memory rate limiting map: IP -> timestamp[]
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string, limit = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const validTimestamps = timestamps.filter(t => t > now - windowMs);
  if (validTimestamps.length >= limit) {
    return false;
  }
  validTimestamps.push(now);
  rateLimitMap.set(ip, validTimestamps);
  return true;
}

/**
 * Extract value from nested or flat Elementor form payloads
 */
function extractFieldValue(raw: Record<string, any>, preferredKey?: string, fallbacks: string[] = []): string | undefined {
  const keysToTest = preferredKey ? [preferredKey, ...fallbacks] : fallbacks;

  for (const key of keysToTest) {
    // 1. Direct top-level match
    if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') {
      return String(raw[key]).trim();
    }

    // 2. Elementor Pro form_fields[key] object format
    if (raw.form_fields && typeof raw.form_fields === 'object') {
      const fieldVal = raw.form_fields[key];
      if (fieldVal !== undefined && fieldVal !== null) {
        if (typeof fieldVal === 'object' && fieldVal.value !== undefined) {
          return String(fieldVal.value).trim();
        }
        return String(fieldVal).trim();
      }
    }

    // 3. Elementor Pro fields[key] array or object format
    if (raw.fields && typeof raw.fields === 'object') {
      if (Array.isArray(raw.fields)) {
        const found = raw.fields.find((f: any) => f.id === key || f.name === key || f.title?.toLowerCase() === key.toLowerCase());
        if (found && found.value !== undefined) {
          return String(found.value).trim();
        }
      } else if (raw.fields[key] !== undefined) {
        const fieldVal = raw.fields[key];
        if (typeof fieldVal === 'object' && fieldVal.value !== undefined) {
          return String(fieldVal.value).trim();
        }
        return String(fieldVal).trim();
      }
    }
  }

  return undefined;
}

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown-ip';

  // 1. Rate Limiting
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded for lead submissions. Please retry later.'
    }, { status: 429 });
  }

  const org = db.organizations.findFirst();
  if (!org) {
    return NextResponse.json({ error: 'Organization not initialized' }, { status: 500 });
  }

  // 2. Fetch or initialize Elementor Pro integration connection
  let conn = db.integrations.findByProvider(org.id, 'elementor_pro');
  if (!conn) {
    conn = db.integrations.upsert(org.id, 'elementor_pro', {
      status: 'configuration_incomplete',
      config: {
        webhook_endpoint_url: `${req.nextUrl.origin}/api/integrations/elementor/leads`,
        signing_secret: 'ptp_elem_sec_' + crypto.randomBytes(16).toString('hex'),
        secret_token: 'ptp_tok_' + crypto.randomBytes(12).toString('hex'),
        field_mappings: {
          fullName: 'name',
          firstName: 'first_name',
          lastName: 'last_name',
          email: 'email',
          phone: 'phone',
          courseInterest: 'course',
          deliveryVariant: 'delivery_variant',
          message: 'message',
          stateOrPostcode: 'state',
          consent: 'consent',
          formId: 'form_id',
          pageUrl: 'page_url',
        },
        auto_create_followup_task: true,
        suppress_test_emails: true,
      }
    });
  }

  const config = conn.config || {};
  const serverSigningSecret = config.signing_secret || process.env.PTP_ELEMENTOR_SECRET;
  const serverSecretToken = config.secret_token;

  // 3. Read raw body with request size limit
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Payload too large', maxBytes: MAX_PAYLOAD_BYTES }, { status: 413 });
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Payload too large', maxBytes: MAX_PAYLOAD_BYTES }, { status: 413 });
  }

  // 4. Authenticate Request
  // Method A: HMAC-SHA256 Signature (Recommended WordPress Adapter Method)
  // Headers: X-PTP-Signature, X-PTP-Timestamp, X-PTP-Event-ID
  const signatureHeader = req.headers.get('x-ptp-signature') || req.headers.get('x-signature') || req.headers.get('x-hub-signature-256');
  const timestampHeader = req.headers.get('x-ptp-timestamp');
  const eventIdHeader = req.headers.get('x-ptp-event-id');

  // Method B: Secret Token in Header or Query (Native Elementor Webhook Method)
  const webhookSecretHeader = req.headers.get('x-elementor-webhook-secret') || req.headers.get('x-webhook-secret');
  const querySecret = req.nextUrl.searchParams.get('secret');

  let isAuthenticated = false;
  let authMethod = 'none';

  if (signatureHeader && serverSigningSecret) {
    authMethod = 'hmac_sha256';
    // Validate timestamp for replay protection
    if (timestampHeader) {
      const ts = parseInt(timestampHeader, 10);
      const nowSec = Math.floor(Date.now() / 1000);
      if (isNaN(ts) || Math.abs(nowSec - ts) > MAX_TIMESTAMP_DRIFT_SEC) {
        db.integrations.upsert(org.id, 'elementor_pro', {
          status: 'authentication_failed',
          last_error: `Timestamp drift exceeded: provided=${ts}, current=${nowSec}`,
          failure_count: (conn.failure_count || 0) + 1,
        });

        db.auditEvents.create({
          organization_id: org.id,
          actor_name: 'Elementor Webhook Security',
          action: 'webhook_auth_rejected_stale_timestamp',
          target_type: 'integration',
          target_id: conn.id,
          ip_address: clientIp,
          details: { error: 'Replay protection: stale timestamp' }
        });

        return NextResponse.json({ 
          error: 'Unauthorized: Timestamp expired or invalid clock skew', 
          code: 'STALE_TIMESTAMP' 
        }, { status: 401 });
      }
    }

    // Verify HMAC
    const cleanSig = signatureHeader.replace(/^sha256=/i, '').trim();
    const computedHmac = crypto.createHmac('sha256', serverSigningSecret).update(rawBody).digest('hex');
    
    // Constant time comparison (checking length first to safely handle malformed signatures)
    const sigBuffer = Buffer.from(cleanSig, 'utf8');
    const compBuffer = Buffer.from(computedHmac, 'utf8');
    if (sigBuffer.length === compBuffer.length && crypto.timingSafeEqual(sigBuffer, compBuffer)) {
      isAuthenticated = true;
    }
  } else if ((webhookSecretHeader && serverSecretToken) || (querySecret && serverSecretToken)) {
    authMethod = 'token';
    const providedToken = (webhookSecretHeader || querySecret || '').trim();
    if (providedToken === serverSecretToken || (serverSigningSecret && providedToken === serverSigningSecret)) {
      isAuthenticated = true;
    }
  }

  // Reject unauthorized requests
  if (!isAuthenticated) {
    db.integrations.upsert(org.id, 'elementor_pro', {
      status: 'authentication_failed',
      last_error: `Invalid authentication credentials received from IP ${clientIp}. Auth method: ${authMethod}`,
      failure_count: (conn.failure_count || 0) + 1,
    });

    db.auditEvents.create({
      organization_id: org.id,
      actor_name: 'Elementor Webhook Security',
      action: 'webhook_authentication_failed',
      target_type: 'integration',
      target_id: conn.id,
      ip_address: clientIp,
      details: { 
        ip: clientIp, 
        auth_method: authMethod,
        has_signature: !!signatureHeader,
        has_token: !!(webhookSecretHeader || querySecret)
      }
    });

    return NextResponse.json({
      error: 'Unauthorized: Invalid signature or secret token',
      code: 'AUTHENTICATION_FAILED',
      help: 'Configure the server signing secret in WordPress or pass ?secret=... matching your CRM integration settings.'
    }, { status: 401 });
  }

  // 5. Parse Payload (JSON or Form URL-Encoded)
  let parsedPayload: Record<string, any> = {};
  const contentType = req.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      parsedPayload = JSON.parse(rawBody);
    } else {
      // Form URL-Encoded or multipart fallback
      const params = new URLSearchParams(rawBody);
      params.forEach((val, key) => {
        // Handle PHP array notation: form_fields[name] -> form_fields.name
        const match = key.match(/^([^\[]+)\[([^\]]+)\]$/);
        if (match) {
          const parent = match[1];
          const child = match[2];
          if (!parsedPayload[parent]) parsedPayload[parent] = {};
          parsedPayload[parent][child] = val;
        } else {
          parsedPayload[key] = val;
        }
      });
    }
  } catch (err: any) {
    return NextResponse.json({
      error: 'Bad Request: Unable to parse payload',
      details: err.message
    }, { status: 400 });
  }

  // 6. Deduplication & Idempotency Key Handling
  // If adapter provides stable event ID via header or body, use it
  const stableEventId = eventIdHeader || parsedPayload.event_id || parsedPayload._ptp_event_id || parsedPayload.submission_id;
  const emailVal = extractFieldValue(parsedPayload, config.field_mappings?.email, ['email', 'Email', 'user_email', 'your-email']);

  if (!emailVal) {
    return NextResponse.json({
      error: 'Validation failed: Email address is required in submission',
      field_mappings: config.field_mappings
    }, { status: 422 });
  }

  const idempotencyKey = stableEventId 
    ? `elem_${stableEventId}` 
    : `elem_${emailVal.toLowerCase()}_${parsedPayload.form_id || 'form'}_${Math.floor(Date.now() / 60000)}`;

  // Check if this event was already received and processed
  const existingEvent = db.webhookEvents.findByIdempotencyKey(org.id, 'elementor_pro', idempotencyKey);
  if (existingEvent && existingEvent.status === 'processed') {
    return NextResponse.json({
      success: true,
      status: 'duplicate_ignored',
      message: 'Webhook retry acknowledged safely without creating duplicate enquiry or notifications.',
      event_id: idempotencyKey,
    }, { status: 200 });
  }

  // 7. Extract Fields using Configurable Mappings
  const mappings: ElementorFieldMappings = config.field_mappings || {};

  let fullName = extractFieldValue(parsedPayload, mappings.fullName, ['name', 'full_name', 'Name', 'your-name']);
  const firstName = extractFieldValue(parsedPayload, mappings.firstName, ['first_name', 'FirstName', 'fname']);
  const lastName = extractFieldValue(parsedPayload, mappings.lastName, ['last_name', 'LastName', 'lname']);

  if (!fullName && (firstName || lastName)) {
    fullName = [firstName, lastName].filter(Boolean).join(' ');
  }
  if (!fullName) {
    fullName = emailVal.split('@')[0];
  }

  const phone = extractFieldValue(parsedPayload, mappings.phone, ['phone', 'telephone', 'mobile', 'Phone', 'contact_number', 'your-phone']);
  const courseInterest = extractFieldValue(parsedPayload, mappings.courseInterest, ['course', 'course_interest', 'Course', 'course_name', 'selected_course']);
  const deliveryVariant = extractFieldValue(parsedPayload, mappings.deliveryVariant, ['delivery_variant', 'delivery_mode', 'study_mode', 'delivery']);
  const message = extractFieldValue(parsedPayload, mappings.message, ['message', 'Message', 'comments', 'enquiry', 'notes', 'your-message']);
  const stateOrPostcode = extractFieldValue(parsedPayload, mappings.stateOrPostcode, ['state', 'postcode', 'location', 'suburb', 'state_or_postcode', 'zip']);
  const consentRaw = extractFieldValue(parsedPayload, mappings.consent, ['consent', 'privacy_consent', 'terms', 'agreement']);
  const consent = consentRaw === '1' || consentRaw === 'true' || consentRaw === 'on' || consentRaw === 'yes';

  const formId = extractFieldValue(parsedPayload, mappings.formId, ['form_id', 'form_name', '_elementor_form_id', 'formId']) || 'elementor_website_form';
  const pageUrl = extractFieldValue(parsedPayload, mappings.pageUrl, ['page_url', 'referer_title', 'url', 'page', 'current_url']);

  // Extract UTMs and ad tracking IDs
  const utmSource = parsedPayload.utm_source || extractFieldValue(parsedPayload, undefined, ['utm_source']);
  const utmMedium = parsedPayload.utm_medium || extractFieldValue(parsedPayload, undefined, ['utm_medium']);
  const utmCampaign = parsedPayload.utm_campaign || extractFieldValue(parsedPayload, undefined, ['utm_campaign']);
  const utmTerm = parsedPayload.utm_term || extractFieldValue(parsedPayload, undefined, ['utm_term']);
  const utmContent = parsedPayload.utm_content || extractFieldValue(parsedPayload, undefined, ['utm_content']);
  const gclid = parsedPayload.gclid || extractFieldValue(parsedPayload, undefined, ['gclid']);
  const fbclid = parsedPayload.fbclid || extractFieldValue(parsedPayload, undefined, ['fbclid']);
  const isTest = Boolean(parsedPayload.is_test || parsedPayload.test_submission || emailVal.includes('test'));

  // 8. Determine Marketing Source
  let marketingSource: any = 'organic';
  if (gclid || utmSource?.toLowerCase().includes('google')) {
    marketingSource = 'google';
  } else if (fbclid || utmSource?.toLowerCase().includes('meta') || utmSource?.toLowerCase().includes('facebook') || utmSource?.toLowerCase().includes('instagram')) {
    marketingSource = 'meta';
  } else if (utmSource) {
    marketingSource = utmSource.toLowerCase();
  }

  // 9. Persist Webhook Event Durably
  db.webhookEvents.create({
    organization_id: org.id,
    provider: 'elementor_pro',
    idempotency_key: idempotencyKey,
    headers: {
      client_ip: clientIp,
      auth_method: authMethod,
      content_type: contentType,
      has_signature: !!signatureHeader,
    },
    raw_body: rawBody,
    status: 'received',
  });

  try {
    // 10. Process through CRM Lead Processor (Deduplication, 50/50 Round-Robin, Tasks, Notifications)
    const result = await LeadProcessor.processLead({
      organizationId: org.id,
      fullName,
      email: emailVal,
      phone,
      country: 'Australia',
      city: 'Adelaide',
      stateOrPostcode,
      courseInterest,
      deliveryVariant,
      captureChannel: 'website',
      marketingSource,
      provider: 'elementor_pro',
      providerLeadId: stableEventId || idempotencyKey,
      formId,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      gclid,
      fbclid,
      landingPage: pageUrl,
      referrer: req.headers.get('referer') || undefined,
      submittedFields: {
        message,
        consent_accepted: consent,
        raw_form_fields: parsedPayload,
      },
      consentText: consent ? 'User provided privacy consent via WordPress Elementor form submission.' : undefined,
      consentTimestamp: consent ? new Date().toISOString() : undefined,
      idempotencyKey,
      isTest,
    });

    // Mark webhook event as processed
    db.webhookEvents.updateStatus(org.id, 'elementor_pro', idempotencyKey, 'processed');

    // Update integration health status
    const now = new Date().toISOString();
    db.integrations.upsert(org.id, 'elementor_pro', {
      status: 'connected_and_verified',
      last_verified_at: now,
      last_activity_at: now,
      last_error: undefined,
      failure_count: 0,
      config: {
        ...config,
        last_received_at: now,
        last_success_at: now,
        last_error: undefined,
        failure_count: 0,
      }
    });

    return NextResponse.json({
      success: true,
      message: 'WordPress Elementor enquiry successfully received and processed',
      status: result.status,
      contact: {
        id: result.contact.id,
        full_name: result.contact.full_name,
        email: result.contact.email,
        assigned_agent: result.assignedAgent ? result.assignedAgent.full_name : null,
      },
      matched_course: result.matchedCourse ? {
        code: result.matchedCourse.code,
        title: result.matchedCourse.title,
      } : null,
      course_review_required: result.contact.course_review_required || false,
      submission_id: result.submission.id,
    }, { status: 201 });

  } catch (err: any) {
    console.error('Error processing Elementor form lead:', err);

    db.webhookEvents.updateStatus(org.id, 'elementor_pro', idempotencyKey, 'failed', err.message);

    db.integrations.upsert(org.id, 'elementor_pro', {
      status: 'processing_error',
      last_error: `Processing error: ${err.message}`,
      failure_count: (conn.failure_count || 0) + 1,
    });

    return NextResponse.json({
      error: 'Processing Error',
      message: err.message,
    }, { status: 500 });
  }
}

// Support CORS Pre-flight for cross-origin browser or WordPress requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-PTP-Signature, X-PTP-Timestamp, X-PTP-Event-ID, X-Elementor-Webhook-Secret',
    },
  });
}
