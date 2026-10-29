import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizePhone } from '@/lib/utils/normalization';
import { CallOutcome, CallLog } from '@/types/crm';

/**
 * 3CX Call Journaling Endpoint (ReportCall Scenario)
 * POST /api/integrations/3cx/journal
 */
export async function POST(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown-ip';

  const org = db.organizations.findFirst();
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 500 });
  }

  // 1. Authenticate Request
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
    db.auditEvents.create({
      organization_id: org.id,
      actor_name: '3CX Security Monitor',
      action: '3cx_journal_auth_failed',
      target_type: 'integration',
      target_id: conn?.id || 'three_cx',
      ip_address: clientIp,
      details: { error: 'Invalid or missing API key during call journaling' }
    });

    if (conn) {
      db.integrations.upsert(org.id, 'three_cx', {
        status: 'authentication_failed',
        last_error: `Journal auth failure from IP ${clientIp}`,
        failure_count: (conn.failure_count || 0) + 1,
      });
    }

    return NextResponse.json({
      error: 'Unauthorized',
      message: 'Invalid 3CX integration API key'
    }, { status: 401 });
  }

  // 2. Parse 3CX Payload
  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const callId = body.call_id || body.CallId || body.callId;
  if (!callId) {
    return NextResponse.json({ error: 'Validation failed: call_id is required' }, { status: 422 });
  }

  const rawNumber = String(body.number || body.Number || body.destination || body.caller || '').trim();
  const rawType = String(body.call_type || body.CallType || body.type || 'Inbound').trim().toLowerCase();
  const rawStatus = String(body.status || body.Status || body.call_status || body.CallStatus || 'Completed').trim().toLowerCase();
  const rawDuration = Number(body.duration || body.Duration || 0);
  const agentExt = String(body.agent_extension || body.AgentExtension || body.AgentExt || body.extension || '').trim();
  const notes = body.notes || body.Notes || body.subject || body.Subject || '';
  const recordingUrl = body.recording_url || body.RecordingUrl || undefined;
  const startTime = body.call_start_time || body.CallStartTime || new Date().toISOString();

  // 3. Resolve Calling Agent by Extension Mapping
  // Extension mapping rules (configurable in CRM Integration Settings):
  // Default: Ayesha Sohail -> 101, Maryam Touqeer -> 102
  const agentExtensions = conn?.config?.agent_extensions || {
    ayesha_extension: '101',
    maryam_extension: '102',
  };

  const allProfiles = db.profiles.findMany(org.id);
  const ayesha = allProfiles.find(p => p.email.toLowerCase().includes('ayesha'));
  const maryam = allProfiles.find(p => p.email.toLowerCase().includes('maryam'));
  const jawad = allProfiles.find(p => p.email.toLowerCase().includes('jawad'));
  const sohail = allProfiles.find(p => p.email.toLowerCase().includes('sohail'));

  let resolvedAgent = null;
  if (agentExt) {
    if (agentExt === agentExtensions.ayesha_extension && ayesha) {
      resolvedAgent = ayesha;
    } else if (agentExt === agentExtensions.maryam_extension && maryam) {
      resolvedAgent = maryam;
    } else if (agentExt === agentExtensions.jawad_extension && jawad) {
      resolvedAgent = jawad;
    } else if (agentExt === agentExtensions.sohail_extension && sohail) {
      resolvedAgent = sohail;
    }
  }

  // 4. Match Contact by Phone Number
  const normPhone = normalizePhone(rawNumber);
  const rawDigits = rawNumber.replace(/\D/g, '');
  const allContacts = db.contacts.findMany(org.id);

  let matchedContact = allContacts.find(c => {
    if (c.phone_normalized && c.phone_normalized === normPhone) return true;
    if (c.phone && normalizePhone(c.phone) === normPhone) return true;
    const cDigits = (c.phone || '').replace(/\D/g, '');
    if (rawDigits.length >= 8 && cDigits.length >= 8) {
      return rawDigits.endsWith(cDigits.slice(-8)) || cDigits.endsWith(rawDigits.slice(-8));
    }
    return false;
  });

  // If no contact matched and inbound call, create an inbound contact automatically
  if (!matchedContact && rawNumber) {
    // If agent is not resolved by extension, assign to round-robin
    const assignedAgent = resolvedAgent || db.organizations.getNextRoundRobinAgent(org.id);
    
    matchedContact = db.contacts.create({
      id: `cont_3cx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: org.id,
      assigned_agent_id: assignedAgent.id,
      full_name: `Caller ${rawNumber}`,
      first_name: 'Caller',
      last_name: rawNumber,
      email: `caller.${rawDigits.slice(-6) || Date.now()}@inbound.ptp.local`,
      phone: rawNumber,
      phone_normalized: normPhone || rawNumber,
      lifecycle_stage: 'lead',
      lead_status: 'new',
      capture_channel: 'phone',
      marketing_source: 'organic',
      notes: `Inbound caller logged automatically from 3CX Phone System (Extension ${agentExt || 'Queue'}).`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // If agent wasn't resolved by extension, attribute to contact's assigned agent or first owner
  if (!resolvedAgent && matchedContact?.assigned_agent_id) {
    resolvedAgent = db.profiles.findById(matchedContact.assigned_agent_id);
  }
  if (!resolvedAgent) {
    resolvedAgent = ayesha || allProfiles[0];
  }

  // 5. Map 3CX Status to CRM CallOutcome
  let outcome: CallOutcome = 'connected';
  let callStatus: CallLog['call_status'] = 'completed';

  if (rawStatus.includes('miss') || rawType === 'missed') {
    outcome = 'no_answer';
    callStatus = 'missed';
  } else if (rawStatus.includes('busy')) {
    outcome = 'busy';
    callStatus = 'busy';
  } else if (rawStatus.includes('fail')) {
    outcome = 'wrong_number';
    callStatus = 'failed';
  } else if (rawDuration > 0 || rawStatus.includes('answer') || rawStatus.includes('complete')) {
    outcome = 'connected';
    callStatus = rawDuration > 0 ? 'completed' : 'answered';
  }

  const direction: 'inbound' | 'outbound' = rawType.includes('out') ? 'outbound' : 'inbound';

  // 6. Deduplicate & Reconcile Updates to the Same Call ID
  const existingCall = db.callLogs.findByProviderCallId(org.id, String(callId));

  let callLogResult: CallLog;
  if (existingCall) {
    // Reconcile and update existing call record (e.g. initiated -> completed)
    const updated = db.callLogs.update(existingCall.id, {
      duration_seconds: rawDuration || existingCall.duration_seconds,
      call_status: callStatus,
      outcome: outcome,
      notes: notes ? (existingCall.notes ? `${existingCall.notes}\n${notes}` : notes) : existingCall.notes,
      recording_url: recordingUrl || existingCall.recording_url,
      agent_extension: agentExt || existingCall.agent_extension,
    });
    callLogResult = updated || existingCall;
  } else {
    // Create new call log
    callLogResult = db.callLogs.create({
      id: `call_3cx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: org.id,
      contact_id: matchedContact ? matchedContact.id : 'unknown',
      agent_id: resolvedAgent ? resolvedAgent.id : (matchedContact?.assigned_agent_id || 'unassigned'),
      timestamp: startTime,
      outcome,
      duration_seconds: rawDuration,
      notes: notes || `3CX ${direction} call recorded (${rawStatus}, duration: ${rawDuration}s)`,
      provider: '3cx',
      provider_call_id: String(callId),
      direction,
      call_status: callStatus,
      agent_extension: agentExt,
      caller_number: rawNumber,
      destination_number: direction === 'outbound' ? rawNumber : agentExt,
      recording_url: recordingUrl,
      created_at: new Date().toISOString(),
    });
  }

  // 7. Follow-up Workflow on Missed or Incomplete Calls
  if (callStatus === 'missed' && matchedContact && resolvedAgent) {
    db.tasks.create({
      id: `task_cb_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: org.id,
      contact_id: matchedContact.id,
      assigned_agent_id: resolvedAgent.id,
      title: `3CX Missed Call: Callback required for ${matchedContact.full_name}`,
      description: `Inbound missed call received from ${rawNumber} on extension ${agentExt}. Follow up promptly.`,
      due_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // due in 1 hour
      priority: 'high',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    db.notifications.create({
      organization_id: org.id,
      user_id: resolvedAgent.id,
      title: 'Missed Call Alert (3CX)',
      message: `Missed call from ${matchedContact.full_name} (${rawNumber}) on extension ${agentExt}. Callback task created.`,
      link: `/contacts/${matchedContact.id}`,
      type: 'followup_due',
    });
  }

  // 8. Record Audit Event & Update Integration Health
  db.auditEvents.create({
    organization_id: org.id,
    actor_name: `3CX Phone System (Ext ${agentExt || 'PBX'})`,
    action: existingCall ? '3cx_call_reconciled' : '3cx_call_journaled',
    target_type: 'call_log',
    target_id: callLogResult.id,
    ip_address: clientIp,
    details: {
      call_id: callId,
      direction,
      duration_seconds: rawDuration,
      status: callStatus,
      agent_name: resolvedAgent?.full_name,
      contact_name: matchedContact?.full_name,
    }
  });

  const now = new Date().toISOString();
  db.integrations.upsert(org.id, 'three_cx', {
    status: 'connected_and_verified',
    last_verified_at: now,
    last_activity_at: now,
    last_error: undefined,
    failure_count: 0,
    config: {
      ...(conn?.config || {}),
      last_call_received_at: now,
      last_call_id: callId,
      last_call_agent: resolvedAgent?.full_name,
    }
  });

  return NextResponse.json({
    success: true,
    reconciled: !!existingCall,
    call_log: {
      id: callLogResult.id,
      call_id: callId,
      contact_id: matchedContact?.id,
      contact_name: matchedContact?.full_name,
      agent_id: resolvedAgent?.id,
      agent_name: resolvedAgent?.full_name,
      agent_extension: agentExt,
      duration_seconds: rawDuration,
      outcome,
      call_status: callStatus,
      direction,
    }
  }, { status: existingCall ? 200 : 201 });
}
