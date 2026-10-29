import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LeadProcessor } from '@/lib/services/lead-processor';

export async function POST(req: NextRequest) {
  try {
    const org = db.organizations.findFirst();
    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 500 });

    const googleConn = db.integrations.findByProvider(org.id, 'google_ads');
    const configuredKey = googleConn?.credentials_encrypted?.google_key || 
      process.env.GOOGLE_LEAD_FORM_KEY || 
      'google_lead_secret_key_pracpathways_2026';

    const body = await req.json();

    // 1. Verify google_key
    if (!body.google_key || body.google_key !== configuredKey) {
      return NextResponse.json({ error: 'Unauthorized: Invalid google_key' }, { status: 401 });
    }

    // 2. Parse Google Lead Form Schema
    // lead_id must be kept as string to prevent 64-bit integer precision loss
    const leadId = String(body.lead_id || `google_${Date.now()}`);
    const formId = String(body.form_id || '');
    const campaignId = String(body.campaign_id || '');
    const isTest = !!body.is_test;

    const columnData: Record<string, string> = {};
    let fullName = '';
    let email = '';
    let phone = '';
    let company = '';
    let city = '';

    if (Array.isArray(body.user_column_data)) {
      body.user_column_data.forEach((col: { column_id: string; string_value?: string }) => {
        const id = col.column_id;
        const val = col.string_value || '';
        columnData[id] = val;

        if (id === 'FULL_NAME') fullName = val;
        if (id === 'FIRST_NAME' && !fullName) fullName = val;
        if (id === 'LAST_NAME' && fullName) fullName += ' ' + val;
        if (id === 'EMAIL') email = val;
        if (id === 'PHONE_NUMBER') phone = val;
        if (id === 'COMPANY_NAME') company = val;
        if (id === 'CITY') city = val;
      });
    }

    if (!fullName) fullName = `Google Lead (${leadId})`;
    if (!email) email = `google_${leadId}@lead.example.com`;

    // 3. Ingest via LeadProcessor
    const result = await LeadProcessor.processLead({
      organizationId: org.id,
      fullName,
      email,
      phone,
      company,
      city,
      country: 'Pakistan',
      captureChannel: 'google_ads',
      marketingSource: 'google',
      provider: 'google',
      providerLeadId: leadId,
      formId,
      campaignId,
      campaignName: 'Google Native Lead Form Campaign',
      submittedFields: columnData,
      idempotencyKey: `google_${leadId}`,
      isTest,
      rawPayload: body,
    });

    return NextResponse.json({
      success: true,
      status: result.status,
      contactId: result.contact.id,
      isTest,
    }, { status: 200 });

  } catch (err: any) {
    console.error('Error in Google Ads webhook:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
