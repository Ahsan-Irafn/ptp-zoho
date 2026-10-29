import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { generateCsv } from '@/lib/utils/normalization';
import { formatAdelaideDateTime } from '@/lib/utils/date';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only Owners are permitted to export the database contacts
  if (user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: Agents cannot export database' }, { status: 403 });
  }

  const org = db.organizations.findFirst();
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 500 });

  const contacts = db.contacts.findMany(org.id);
  const profiles = db.profiles.findMany(org.id);

  const headers = [
    'ID',
    'Full Name',
    'Email',
    'Email Normalized',
    'Phone Raw',
    'Phone Normalized',
    'Course Interest',
    'Delivery Variant',
    'State / Postcode',
    'City',
    'Country',
    'Lifecycle Status',
    'Assigned Agent',
    'Do Not Call',
    'Email Suppressed',
    'First Enquiry Date (Adelaide)',
    'Latest Enquiry Date (Adelaide)',
    'Next Follow-up (Adelaide)',
    'Tags'
  ];

  const rows = contacts.map(c => {
    const agent = profiles.find(p => p.id === c.assigned_agent_id);
    return [
      c.id,
      c.full_name,
      c.email,
      c.email_normalized,
      c.phone_raw || '',
      c.phone_normalized || '',
      c.course_interest || '',
      c.delivery_variant || '',
      c.state_or_postcode || '',
      c.city || '',
      c.country || '',
      c.lifecycle_status,
      agent ? agent.full_name : 'Unassigned',
      c.do_not_call ? 'Yes' : 'No',
      c.email_suppressed ? 'Yes' : 'No',
      formatAdelaideDateTime(c.first_enquiry_at),
      formatAdelaideDateTime(c.latest_enquiry_at),
      formatAdelaideDateTime(c.next_follow_up_at),
      c.tags.join('; ')
    ];
  });

  const csv = generateCsv(headers, rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ptp_contacts_export_${Date.now()}.csv"`,
    },
  });
}
