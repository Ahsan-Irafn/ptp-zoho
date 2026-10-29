import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { permissions } from '@/lib/auth/permissions';
import { normalizePhone } from '@/lib/utils/normalization';

/**
 * Click-to-Call Initiation Endpoint (3CX Verified Initiation)
 * POST /api/integrations/3cx/makecall
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Please log in to initiate calls' }, { status: 401 });
    }

    const body = await req.json();
    const { contact_id } = body;

    if (!contact_id) {
      return NextResponse.json({ error: 'contact_id is required' }, { status: 400 });
    }

    const contact = db.contacts.findById(contact_id);
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Permission enforcement: Calling agents can ONLY call assigned contacts
    if (!permissions.canAccessContact(user.role, user.id, contact)) {
      return NextResponse.json({
        error: 'Forbidden: You are not authorized to call contacts assigned to another agent.',
        code: 'AGENT_ACCESS_RESTRICTED'
      }, { status: 403 });
    }

    // Do not call check
    if (contact.do_not_call) {
      return NextResponse.json({
        error: 'Cannot initiate call: Contact is marked Do Not Call (DNC).',
        code: 'CONTACT_DO_NOT_CALL'
      }, { status: 400 });
    }

    const rawPhone = contact.phone || contact.phone_normalized;
    if (!rawPhone) {
      return NextResponse.json({ error: 'Contact does not have a phone number on file.' }, { status: 400 });
    }

    const cleanNumber = normalizePhone(rawPhone);
    const org = db.organizations.findById(contact.organization_id);
    const conn = org ? db.integrations.findByProvider(org.id, 'three_cx') : undefined;

    // Resolve agent's configured 3CX extension
    const agentExtensions = conn?.config?.agent_extensions || {
      ayesha_extension: '101',
      maryam_extension: '102',
    };

    let agentExtension = '101';
    if (user.email.toLowerCase().includes('ayesha')) {
      agentExtension = agentExtensions.ayesha_extension || '101';
    } else if (user.email.toLowerCase().includes('maryam')) {
      agentExtension = agentExtensions.maryam_extension || '102';
    } else if (user.email.toLowerCase().includes('jawad')) {
      agentExtension = agentExtensions.jawad_extension || '100';
    } else if (user.email.toLowerCase().includes('sohail')) {
      agentExtension = agentExtensions.sohail_extension || '103';
    }

    const isConnected = conn && conn.status === 'connected_and_verified';
    const pbxUrl = conn?.config?.pbx_url || 'https://ptp.3cx.com.au:5001';
    const cleanPbxUrl = pbxUrl.replace(/\/+$/, '');

    // Generate stable call ID for 3CX reconciliation
    const providerCallId = `3cx_out_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create an initial call log in "initiated" status (Do NOT mark connected merely because dialer opened!)
    const initialCallLog = db.callLogs.create({
      id: `call_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: contact.organization_id,
      contact_id: contact.id,
      agent_id: user.id,
      timestamp: new Date().toISOString(),
      outcome: 'no_answer', // Initial placeholder until 3CX journals completion
      duration_seconds: 0,
      notes: `Call initiated by ${user.full_name} via 3CX Extension ${agentExtension}. Awaiting connection & journal confirmation.`,
      provider: '3cx',
      provider_call_id: providerCallId,
      direction: 'outbound',
      call_status: 'in_progress' as any,
      agent_extension: agentExtension,
      caller_number: agentExtension,
      destination_number: cleanNumber,
      created_at: new Date().toISOString(),
    });

    // Audit log initiation
    db.auditEvents.create({
      organization_id: contact.organization_id,
      actor_id: user.id,
      actor_name: user.full_name,
      action: '3cx_call_initiated',
      target_type: 'contact',
      target_id: contact.id,
      details: {
        provider_call_id: providerCallId,
        destination_number: cleanNumber,
        agent_extension: agentExtension,
        integration_status: conn?.status || 'not_configured',
      }
    });

    // Construct 3CX WebClient dial link and custom protocol URLs
    const webClientDialUrl = `${cleanPbxUrl}/webclient/#/call?phone=${encodeURIComponent(cleanNumber)}`;
    const tcxDialUri = `tcx:${encodeURIComponent(cleanNumber)}`;
    const basicTelUri = `tel:${encodeURIComponent(cleanNumber)}`;

    return NextResponse.json({
      success: true,
      method: isConnected ? '3cx_integrated' : '3cx_manual_dispatch',
      call_id: providerCallId,
      call_log_id: initialCallLog.id,
      destination_number: cleanNumber,
      agent_extension: agentExtension,
      dial_url: isConnected ? webClientDialUrl : basicTelUri,
      tcx_uri: tcxDialUri,
      tel_uri: basicTelUri,
      status: 'initiated',
      message: isConnected 
        ? `3CX dial dispatch prepared for Extension ${agentExtension}. Call logged as initiated.`
        : '3CX integration not verified. Basic dialer protocol dispatched.',
      integration_verified: isConnected,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
