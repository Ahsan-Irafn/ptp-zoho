import { db } from '../src/lib/db/index.ts';
import { createSessionRecord } from '../src/lib/auth/session.ts';

async function verifyHtmlContent() {
  const org = db.organizations.findFirst();
  const jawad = db.profiles.findByEmail('muhammad.jawad@pracpathways.com.au');
  if (!jawad) throw new Error('Jawad not found');

  // Create real active session for Jawad
  const session = createSessionRecord(jawad);
  const cookie = `ptp_session_token=${session.token}`;
  
  // 1. Contacts
  const res1 = await fetch('http://localhost:3000/contacts', { headers: { Cookie: cookie }, redirect: 'manual' });
  const html1 = await res1.text();
  console.log('Contacts status:', res1.status);
  console.log('Contacts contains All Leads:', html1.includes('All Leads'));
  console.log('Contacts contains Ayesha:', html1.includes("Ayesha"));
  console.log('Contacts contains Maryam:', html1.includes("Maryam"));
  console.log('Contacts contains Unassigned:', html1.includes('Unassigned'));
  console.log('Contacts contains Archived:', html1.includes('Archived'));
  console.log('Contacts contains Lachlan Murray:', html1.includes('Lachlan Murray'));

  // 2. Leads
  const res2 = await fetch('http://localhost:3000/leads', { headers: { Cookie: cookie }, redirect: 'manual' });
  const html2 = await res2.text();
  console.log('Leads status:', res2.status);
  console.log('Leads contains All Enquiries:', html2.includes('All Enquiries'));
  console.log('Leads contains Ingestion Stream:', html2.includes('Enquiry Ingestion Stream'));

  // 3. Settings Modules & Fields
  const res3 = await fetch('http://localhost:3000/settings/modules-and-fields', { headers: { Cookie: cookie }, redirect: 'manual' });
  const html3 = await res3.text();
  console.log('Settings status:', res3.status);
  console.log('Settings contains Modules:', html3.includes('Modules'));
  console.log('Settings contains Create Custom Module:', html3.includes('Create Custom Module'));
  console.log('Settings contains Contacts & Students:', html3.includes('Contacts') && html3.includes('Students'));
}

verifyHtmlContent();
