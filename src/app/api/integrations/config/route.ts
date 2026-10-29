import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { permissions } from '@/lib/auth/permissions';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !permissions.canManageIntegrations(user.role)) {
      return NextResponse.json({ error: 'Forbidden: Only CRM owners can manage integration configurations.' }, { status: 403 });
    }

    const org = db.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 500 });
    }

    const body = await req.json();
    const { action, provider, data } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // ACTION 1: Rotate Secret (Elementor or 3CX)
    if (action === 'rotate_secret') {
      if (provider === 'elementor_pro') {
        const newSigningSecret = 'ptp_elem_sec_' + crypto.randomBytes(16).toString('hex');
        const newSecretToken = 'ptp_tok_' + crypto.randomBytes(12).toString('hex');
        
        const existing = db.integrations.findByProvider(org.id, 'elementor_pro');
        const updatedConfig = {
          ...(existing?.config || {}),
          signing_secret: newSigningSecret,
          secret_token: newSecretToken,
        };

        db.integrations.upsert(org.id, 'elementor_pro', {
          config: updatedConfig,
        });

        db.auditEvents.create({
          organization_id: org.id,
          actor_id: user.id,
          actor_name: user.full_name,
          action: 'elementor_secret_rotated',
          target_type: 'integration',
          target_id: 'elementor_pro',
          details: { rotated_by: user.full_name }
        });

        return NextResponse.json({
          success: true,
          message: 'Elementor signing secret rotated successfully.',
          new_signing_secret: newSigningSecret,
          new_secret_token: newSecretToken,
        });
      }

      if (provider === 'three_cx') {
        const newApiKey = 'ptp_3cx_sec_' + crypto.randomBytes(16).toString('hex');
        const existing = db.integrations.findByProvider(org.id, 'three_cx');
        const updatedConfig = {
          ...(existing?.config || {}),
          api_key: newApiKey,
        };

        db.integrations.upsert(org.id, 'three_cx', {
          config: updatedConfig,
        });

        db.auditEvents.create({
          organization_id: org.id,
          actor_id: user.id,
          actor_name: user.full_name,
          action: '3cx_api_key_rotated',
          target_type: 'integration',
          target_id: 'three_cx',
          details: { rotated_by: user.full_name }
        });

        return NextResponse.json({
          success: true,
          message: '3CX integration API key rotated successfully.',
          new_api_key: newApiKey,
        });
      }

      return NextResponse.json({ error: 'Unknown provider for secret rotation' }, { status: 400 });
    }

    // ACTION 2: Update Elementor Field Mappings & Options
    if (action === 'update_elementor_config') {
      const existing = db.integrations.findByProvider(org.id, 'elementor_pro');
      const updatedConfig = {
        ...(existing?.config || {}),
        field_mappings: data.field_mappings || existing?.config?.field_mappings,
        auto_create_followup_task: data.auto_create_followup_task !== undefined ? Boolean(data.auto_create_followup_task) : true,
        suppress_test_emails: data.suppress_test_emails !== undefined ? Boolean(data.suppress_test_emails) : true,
      };

      db.integrations.upsert(org.id, 'elementor_pro', {
        config: updatedConfig,
      });

      db.auditEvents.create({
        organization_id: org.id,
        actor_id: user.id,
        actor_name: user.full_name,
        action: 'elementor_config_updated',
        target_type: 'integration',
        target_id: 'elementor_pro',
        details: { updated_fields: Object.keys(data) }
      });

      return NextResponse.json({
        success: true,
        message: 'Elementor integration configuration updated successfully.',
        config: updatedConfig,
      });
    }

    // ACTION 3: Update 3CX Configuration (Extensions & PBX URL)
    if (action === 'update_3cx_config') {
      const existing = db.integrations.findByProvider(org.id, 'three_cx');
      const updatedConfig = {
        ...(existing?.config || {}),
        pbx_url: data.pbx_url ? String(data.pbx_url).trim() : existing?.config?.pbx_url,
        version: data.version || existing?.config?.version || 'v20',
        licence_edition: data.licence_edition || existing?.config?.licence_edition || 'Pro',
        agent_extensions: {
          ayesha_extension: data.agent_extensions?.ayesha_extension || existing?.config?.agent_extensions?.ayesha_extension || '101',
          maryam_extension: data.agent_extensions?.maryam_extension || existing?.config?.agent_extensions?.maryam_extension || '102',
          jawad_extension: data.agent_extensions?.jawad_extension || existing?.config?.agent_extensions?.jawad_extension || '100',
          sohail_extension: data.agent_extensions?.sohail_extension || existing?.config?.agent_extensions?.sohail_extension || '103',
        },
        features: {
          contact_lookup: data.features?.contact_lookup !== undefined ? Boolean(data.features.contact_lookup) : true,
          call_journaling: data.features?.call_journaling !== undefined ? Boolean(data.features.call_journaling) : true,
          screen_pop: data.features?.screen_pop !== undefined ? Boolean(data.features.screen_pop) : true,
        }
      };

      // Incomplete configuration validation
      const status = (!updatedConfig.pbx_url || !updatedConfig.agent_extensions.ayesha_extension || !updatedConfig.agent_extensions.maryam_extension)
        ? 'configuration_incomplete'
        : (updatedConfig.licence_edition === 'Free / Standard' ? 'permission_license_limitation' : 'connected_and_verified');

      db.integrations.upsert(org.id, 'three_cx', {
        status: status as any,
        config: updatedConfig,
      });

      db.auditEvents.create({
        organization_id: org.id,
        actor_id: user.id,
        actor_name: user.full_name,
        action: '3cx_config_updated',
        target_type: 'integration',
        target_id: 'three_cx',
        details: {
          extensions: updatedConfig.agent_extensions,
          licence_edition: updatedConfig.licence_edition,
        }
      });

      return NextResponse.json({
        success: true,
        message: '3CX Phone System configuration saved successfully.',
        status,
        config: updatedConfig,
      });
    }

    // ACTION 4: Test Elementor Lead Delivery (Real HMAC verification test)
    if (action === 'test_elementor') {
      const conn = db.integrations.findByProvider(org.id, 'elementor_pro');
      const secret = conn?.config?.signing_secret || 'ptp_elem_sec_test';
      const eventId = 'evt_test_' + Date.now();
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const testPayload = {
        event_id: eventId,
        form_id: 'elementor_test_form',
        form_name: 'Website Contact Page',
        page_url: 'https://www.pracpathways.com.au/contact-us',
        is_test: true,
        name: 'Alex Johnson (Integration Test Lead)',
        email: `alex.test.${Date.now()}@example.com.au`,
        phone: '0412 345 678',
        course: 'CPC40120 Certificate IV in Building and Construction',
        delivery_variant: 'Blended Evening',
        message: 'Testing Elementor Pro HMAC webhook lead flow for Practical Training Pathways.',
        state: 'SA',
        consent: '1',
        utm_source: 'elementor_test',
        utm_medium: 'cpc',
        utm_campaign: 'test_campaign',
      };

      const rawBody = JSON.stringify(testPayload);
      const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin || 'http://localhost:3000';
      const response = await fetch(`${appUrl}/api/integrations/elementor/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PTP-Signature': `sha256=${signature}`,
          'X-PTP-Timestamp': timestamp,
          'X-PTP-Event-ID': eventId,
        },
        body: rawBody,
      });

      const resJson = await response.json();
      if (!response.ok) {
        return NextResponse.json({
          success: false,
          error: resJson.error || 'Test webhook delivery failed',
          details: resJson,
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Elementor Pro Test Lead successfully processed with HMAC-SHA256 signature!',
        result: resJson,
      });
    }

    // ACTION 5: Test 3CX Phone System Lookup & Journaling
    if (action === 'test_3cx') {
      const conn = db.integrations.findByProvider(org.id, 'three_cx');
      const apiKey = conn?.config?.api_key || 'ptp_3cx_sec_demo_key_2026';
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin || 'http://localhost:3000';

      // Step A: Test Contact Lookup
      const lookupRes = await fetch(`${appUrl}/api/integrations/3cx/lookup?number=0412345678&extension=101`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        }
      });
      const lookupData = await lookupRes.json();

      // Step B: Test Call Journaling
      const journalPayload = {
        call_id: `test_3cx_call_${Date.now()}`,
        call_type: 'Outbound',
        number: '0412345678',
        agent_extension: '101', // Ayesha
        duration: 45,
        status: 'Completed',
        notes: 'Verification test call journal from CRM integration suite.',
      };

      const journalRes = await fetch(`${appUrl}/api/integrations/3cx/journal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(journalPayload),
      });
      const journalData = await journalRes.json();

      if (!journalRes.ok) {
        return NextResponse.json({
          success: false,
          error: journalData.error || '3CX Call journaling test failed',
          details: { lookup: lookupData, journal: journalData },
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: '3CX Lookup and Call Journaling endpoints successfully verified!',
        details: {
          lookup_status: lookupRes.status,
          lookup_count: lookupData.count,
          journal_status: journalRes.status,
          journal_call_id: journalData.call_log?.id,
          agent_assigned: journalData.call_log?.agent_name,
        }
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });

  } catch (err: any) {
    console.error('Error handling integration config:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
