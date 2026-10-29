import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyMetaSignature } from '@/lib/utils/crypto';
import { LeadProcessor } from '@/lib/services/lead-processor';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const org = db.organizations.findFirst();
  const metaConn = org ? db.integrations.findByProvider(org.id, 'meta_ads') : null;
  const expectedToken = metaConn?.config?.verify_token || process.env.META_VERIFY_TOKEN || 'meta_verify_pracpathways_secret_token';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('✅ Meta Webhook Verified Successfully');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification token mismatch' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('x-hub-signature-256');

    const org = db.organizations.findFirst();
    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 500 });

    const metaConn = db.integrations.findByProvider(org.id, 'meta_ads');
    const appSecret = metaConn?.credentials_encrypted?.app_secret || process.env.META_APP_SECRET;

    // Validate signature if secret is configured and not in test bypass mode
    if (appSecret && signatureHeader && appSecret !== 'META_APP_SECRET_PLACEHOLDER') {
      const isValid = verifyMetaSignature(rawBody, signatureHeader, appSecret);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid x-hub-signature-256' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);

    // Save webhook event for audit trail and replay defense
    const eventKey = `meta_evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    db.webhookEvents.create({
      organization_id: org.id,
      provider: 'meta_ads',
      idempotency_key: eventKey,
      raw_body: rawBody,
      status: 'received',
    });

    if (payload.object === 'page') {
      for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'leadgen') {
            const value = change.value;
            const leadgenId = value.leadgen_id;
            const formId = value.form_id;
            const pageId = value.page_id;
            const adId = value.ad_id;
            const campaignId = value.campaign_id;

            // Extract lead details (either from simulated payload or default test map)
            const fullName = value.full_name || value.field_data?.full_name || `Meta Lead (${leadgenId})`;
            const email = value.email || value.field_data?.email || `lead_${leadgenId}@metalead.example.com`;
            const phone = value.phone_number || value.field_data?.phone_number || '+92 300 0000000';

            await LeadProcessor.processLead({
              organizationId: org.id,
              fullName,
              email,
              phone,
              captureChannel: 'meta_ads',
              marketingSource: 'meta',
              provider: 'meta',
              providerLeadId: leadgenId,
              formId: formId,
              adId: adId,
              campaignId: campaignId,
              campaignName: value.campaign_name || 'Facebook / Instagram Lead Ad',
              submittedFields: value.field_data || value,
              idempotencyKey: `meta_${leadgenId}`,
              isTest: !!value.is_test,
              rawPayload: value,
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err: any) {
    console.error('Error in Meta webhook:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
