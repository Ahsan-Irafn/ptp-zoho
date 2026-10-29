import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LeadProcessor } from '@/lib/services/lead-processor';
import { db } from '@/lib/db';

const WebsiteLeadSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  company: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  message: z.string().optional(),
  courseInterest: z.string().optional(),
  // Honeypot spam field: must be empty
  website_hp: z.string().max(0, 'Bot detected').optional(),
  // Attribution parameters
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  gclid: z.string().optional(),
  fbclid: z.string().optional(),
  landing_page: z.string().optional(),
  referrer: z.string().optional(),
  consent: z.boolean().optional(),
  // Optional client idempotency key
  idempotency_key: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const org = db.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 500 });
    }

    const body = await req.json();
    const parsed = WebsiteLeadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: parsed.error.flatten() 
      }, { status: 400 });
    }

    const data = parsed.data;

    // Detect marketing source from UTMs or click IDs
    let marketingSource: any = 'organic';
    if (data.gclid || data.utm_source?.toLowerCase().includes('google')) {
      marketingSource = 'google';
    } else if (data.fbclid || data.utm_source?.toLowerCase().includes('meta') || data.utm_source?.toLowerCase().includes('facebook') || data.utm_source?.toLowerCase().includes('instagram')) {
      marketingSource = 'meta';
    } else if (data.utm_source) {
      marketingSource = data.utm_source.toLowerCase();
    }

    const result = await LeadProcessor.processLead({
      organizationId: org.id,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      company: data.company,
      city: data.city,
      country: data.country || 'Pakistan',
      captureChannel: 'website',
      marketingSource,
      provider: 'website',
      landingPage: data.landing_page,
      referrer: data.referrer,
      utmSource: data.utm_source,
      utmMedium: data.utm_medium,
      utmCampaign: data.utm_campaign,
      utmTerm: data.utm_term,
      utmContent: data.utm_content,
      gclid: data.gclid,
      fbclid: data.fbclid,
      submittedFields: {
        message: data.message,
        course_interest: data.courseInterest,
      },
      consentText: data.consent ? 'User checked privacy and communication consent.' : undefined,
      consentTimestamp: data.consent ? new Date().toISOString() : undefined,
      idempotencyKey: data.idempotency_key,
      isTest: false,
    });

    return NextResponse.json({
      success: true,
      message: 'Enquiry received and processed successfully',
      status: result.status,
      contactId: result.contact.id,
    }, { status: 201 });

  } catch (err: any) {
    console.error('Error processing website lead:', err);
    return NextResponse.json({ 
      error: 'Internal server error processing submission',
      details: err.message 
    }, { status: 500 });
  }
}

// CORS pre-flight support for external websites and WordPress
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    },
  });
}
