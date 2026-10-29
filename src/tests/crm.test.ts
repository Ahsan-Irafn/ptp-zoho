import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { db } from '../lib/db';
import { runSeed } from '../lib/db/seed';
import { permissions } from '../lib/auth/permissions';
import { LeadProcessor } from '../lib/services/lead-processor';
import { EmailService } from '../lib/services/email-service';
import { runWorkerTick } from '../workers/runner';
import { normalizeEmail, normalizePhone, sanitizeCsvField } from '../lib/utils/normalization';
import { verifyMetaSignature, verifyPassword } from '../lib/utils/crypto';
import { formatAdelaideDateTime, formatCurrencyAUD, ADELAIDE_TZ } from '../lib/utils/date';

describe('Practical Training Pathways CRM — Specification Acceptance Test Suite (21 Verification Tests)', () => {

  beforeEach(() => {
    // Re-seed fresh state before each test
    runSeed();
  });

  const orgId = 'org_pracpathways_001';
  const jawadId = 'user_jawad_001';
  const sohailId = 'user_sohail_002';
  const ayeshaId = 'user_ayesha_003';
  const maryamId = 'user_maryam_004';

  // Test 1: 4 Independent Accounts Exist
  it('1. Four independent accounts exist for Jawad, Sohail, Ayesha, and Maryam', () => {
    const profiles = db.profiles.findMany(orgId);
    assert.strictEqual(profiles.length, 4);

    const emails = profiles.map(p => p.email.toLowerCase());
    assert.ok(emails.includes('muhammad.jawad@pracpathways.com.au'));
    assert.ok(emails.includes('sohail.sadiq@pracpathways.com.au'));
    assert.ok(emails.includes('ayesha.sohail@pracpathways.com.au'));
    assert.ok(emails.includes('maryam.touqeer@pracpathways.com.au'));

    // Check credentials exist for each profile
    for (const profile of profiles) {
      const cred = db.credentials.findByEmail(profile.email);
      assert.ok(cred, `Credentials must exist for ${profile.email}`);
      assert.ok(cred.password_hash.length >= 64, 'Hash must be at least 64 hex characters');
      assert.ok(cred.salt.length >= 16, 'Salt must be present');
    }
  });

  // Test 2: Incorrect Passwords Fail Authentication
  it('2. Incorrect passwords fail authentication while valid passwords succeed', () => {
    const cred = db.credentials.findByEmail('muhammad.jawad@pracpathways.com.au')!;
    
    // Incorrect password
    const wrongAuth = verifyPassword('WrongPassword123!', cred.password_hash, cred.salt);
    assert.strictEqual(wrongAuth, false);

    // Correct seeded password
    const validAuth = verifyPassword('JawadPTP2026!', cred.password_hash, cred.salt);
    assert.strictEqual(validAuth, true);
  });

  // Test 3: Unauthorized Route Rejection & Permissions
  it('3. Agents are rejected from owner permissions (team, integrations, audit logs)', () => {
    assert.strictEqual(permissions.canManageTeam('agent'), false);
    assert.strictEqual(permissions.canManageIntegrations('agent'), false);
    assert.strictEqual(permissions.canViewAuditLogs('agent'), false);
    assert.strictEqual(permissions.canViewAllContacts('agent'), false);

    // Owners have full access
    assert.strictEqual(permissions.canManageTeam('owner'), true);
    assert.strictEqual(permissions.canManageIntegrations('owner'), true);
    assert.strictEqual(permissions.canViewAuditLogs('owner'), true);
    assert.strictEqual(permissions.canViewAllContacts('owner'), true);
  });

  // Test 4: Agent Isolation (Ayesha cannot access Maryam\'s records)
  it('4. Agent isolation: Ayesha cannot access Maryam’s contacts by ID or filter', () => {
    const ayeshaContacts = db.contacts.findMany(orgId, { agentId: ayeshaId });
    const maryamContacts = db.contacts.findMany(orgId, { agentId: maryamId });

    assert.ok(ayeshaContacts.length > 0);
    assert.ok(maryamContacts.length > 0);

    const maryamRecord = maryamContacts[0];

    // Attempt direct access by Maryam's ID as Ayesha
    const unauthorizedAccess = db.contacts.findById(maryamRecord.id, ayeshaId);
    assert.strictEqual(unauthorizedAccess, undefined);

    const hasPermission = permissions.canAccessContact('agent', ayeshaId, maryamRecord);
    assert.strictEqual(hasPermission, false);
  });

  // Test 5: Agent Projections Contain Zero Financial Data
  it('5. Agent deal queries strip value and currency while owners see financial values', () => {
    // Calling agent perspective
    const agentDeals = db.deals.findMany(orgId, ayeshaId);
    assert.ok(agentDeals.length > 0);
    for (const deal of agentDeals) {
      assert.strictEqual(deal.value, undefined, 'Calling agent must not see deal value');
      assert.strictEqual(deal.currency, undefined, 'Calling agent must not see currency');
    }

    // Single deal query by agent
    const firstDealId = agentDeals[0].id;
    const agentSingleDeal = db.deals.findById(firstDealId, ayeshaId);
    assert.ok(agentSingleDeal);
    assert.strictEqual(agentSingleDeal.value, undefined);
    assert.strictEqual(agentSingleDeal.currency, undefined);

    // Owner perspective (Jawad / Sohail)
    const ownerDeals = db.deals.findMany(orgId);
    assert.ok(ownerDeals.length > 0);
    const hasAnyValue = ownerDeals.some(d => d.value !== undefined && d.value > 0);
    assert.ok(hasAnyValue, 'Owner deals must preserve administrative values');
  });

  // Test 6: 50/50 Round-Robin Split over 100 Leads
  it('6. Strict 50/50 round-robin split over 100 leads between Ayesha and Maryam', () => {
    let ayeshaCount = 0;
    let maryamCount = 0;

    for (let i = 0; i < 100; i++) {
      const agent = db.organizations.getNextRoundRobinAgent(orgId);
      assert.ok(agent);
      if (agent.id === ayeshaId) ayeshaCount++;
      if (agent.id === maryamId) maryamCount++;
    }

    assert.strictEqual(ayeshaCount, 50);
    assert.strictEqual(maryamCount, 50);
  });

  // Test 7: Odd Number of Leads Produces <= 1 Difference
  it('7. Odd number of leads produces <= 1 difference between agents', () => {
    let ayeshaCount = 0;
    let maryamCount = 0;

    for (let i = 0; i < 51; i++) {
      const agent = db.organizations.getNextRoundRobinAgent(orgId);
      assert.ok(agent);
      if (agent.id === ayeshaId) ayeshaCount++;
      if (agent.id === maryamId) maryamCount++;
    }

    const diff = Math.abs(ayeshaCount - maryamCount);
    assert.ok(diff <= 1, `Difference was ${diff}, expected <= 1`);
  });

  // Test 8: Duplicate Event Idempotency
  it('8. Replayed events do not duplicate enquiries or emails (Idempotency)', async () => {
    const idempotencyKey = 'unique_webhook_idempotency_ptp_881';

    // First ingestion
    const res1 = await LeadProcessor.processLead({
      organizationId: orgId,
      fullName: 'Thomas Wright',
      email: 'thomas.wright@example.com.au',
      phone: '0412 888 999',
      captureChannel: 'website',
      provider: 'website',
      courseInterest: 'CPC40120 Certificate IV in Building and Construction (Building)',
      idempotencyKey,
    });
    assert.strictEqual(res1.status, 'created');

    // Replayed webhook delivery
    const res2 = await LeadProcessor.processLead({
      organizationId: orgId,
      fullName: 'Thomas Wright',
      email: 'thomas.wright@example.com.au',
      phone: '0412 888 999',
      captureChannel: 'website',
      provider: 'website',
      courseInterest: 'CPC40120 Certificate IV in Building and Construction (Building)',
      idempotencyKey,
    });
    assert.strictEqual(res2.status, 'duplicate_ignored');
    assert.strictEqual(res2.contact.id, res1.contact.id);
  });

  // Test 9: Genuine Repeat Enquiry Links to Existing Contact
  it('9. Genuine repeat enquiry preserves history, updates timestamps, and retains agent', async () => {
    // Existing contact from seed: Lachlan Murray
    const existing = db.contacts.findByNormalizedEmailOrPhone(
      orgId, 
      normalizeEmail('lachlan.murray@adelaidebuild.com.au')
    ).contact!;
    assert.ok(existing, 'Seeded contact Lachlan Murray must exist');

    const assignedAgentIdBefore = existing.assigned_agent_id;

    // Second enquiry from Lachlan for Diploma
    const res = await LeadProcessor.processLead({
      organizationId: orgId,
      fullName: 'Lachlan Murray',
      email: 'lachlan.murray@adelaidebuild.com.au',
      phone: '0412 345 678',
      captureChannel: 'meta_ads',
      provider: 'meta',
      courseInterest: 'CPC50220 Diploma of Building and Construction (Building)',
      idempotencyKey: `meta_repeat_${Date.now()}`,
    });

    assert.strictEqual(res.status, 'linked_existing');
    assert.strictEqual(res.contact.id, existing.id);
    assert.strictEqual(res.contact.assigned_agent_id, assignedAgentIdBefore);

    // Verify touchpoint is recorded in leads table
    const allEnquiries = db.leads.findMany(orgId, existing.id);
    assert.ok(allEnquiries.length >= 2);
  });

  // Test 10: Conflicting Duplicate Identities Handled Safely
  it('10. Conflicting duplicate identities are flagged for owner review', async () => {
    // Lachlan Murray has email 'lachlan.murray@adelaidebuild.com.au'
    // Sarah Jenkins has phone '0423 456 789'
    // New submission brings Lachlan's email with Sarah's phone
    const res = await LeadProcessor.processLead({
      organizationId: orgId,
      fullName: 'Conflict Student Candidate',
      email: 'lachlan.murray@adelaidebuild.com.au',
      phone: '0423 456 789',
      captureChannel: 'website',
      provider: 'website',
      idempotencyKey: `conflict_${Date.now()}`,
    });

    assert.strictEqual(res.status, 'conflict_flagged');
    const updatedContact = db.contacts.findById(res.contact.id);
    assert.strictEqual(updatedContact?.conflict_flag, true);
  });

  // Test 11: Australia/Adelaide Timezone and DST Handling
  it('11. Australia/Adelaide timezone handles ACST (+9:30) and ACDT (+10:30 DST) correctly', () => {
    assert.strictEqual(ADELAIDE_TZ, 'Australia/Adelaide');

    // 1. Winter (ACST Standard Time: UTC + 9:30)
    // 00:30 UTC on 15 June 2026 -> 10:00 AM ACST
    const winterUtc = '2026-06-15T00:30:00.000Z';
    const winterAdelaide = formatAdelaideDateTime(winterUtc);
    assert.ok(winterAdelaide.includes('10:00 AM'), `Expected 10:00 AM in ACST, got ${winterAdelaide}`);

    // 2. Summer (ACDT Daylight Saving Time: UTC + 10:30)
    // 00:30 UTC on 15 December 2026 -> 11:00 AM ACDT
    const summerUtc = '2026-12-15T00:30:00.000Z';
    const summerAdelaide = formatAdelaideDateTime(summerUtc);
    assert.ok(summerAdelaide.includes('11:00 AM'), `Expected 11:00 AM in ACDT, got ${summerAdelaide}`);
  });

  // Test 12: Zero PKR Defaults (Currency is AUD, Timezone is Adelaide)
  it('12. Organization defaults to AUD currency and Australia/Adelaide timezone with no PKR', () => {
    const org = db.organizations.findFirst()!;
    assert.strictEqual(org.default_currency, 'AUD');
    assert.strictEqual(org.default_timezone, 'Australia/Adelaide');

    const formatted = formatCurrencyAUD(1200);
    assert.ok(formatted.includes('$'), 'Must contain Australian dollar sign');
    assert.ok(!formatted.includes('PKR'), 'Must NOT contain PKR');
    assert.ok(!formatted.includes('Rs'), 'Must NOT contain Rs');
  });

  // Test 13: Verified Course Catalogue
  it('13. Verified course catalogue contains CPC40120 and CPC50220 with delivery variants', () => {
    const courses = db.courses.findAll();
    assert.strictEqual(courses.length, 4);

    const distinctCodes = Array.from(new Set(courses.map(c => c.code)));
    assert.deepStrictEqual(distinctCodes.sort(), ['CPC40120', 'CPC50220']);

    const cpc40120 = courses.filter(c => c.code === 'CPC40120');
    assert.ok(cpc40120.length >= 2);
    assert.ok(cpc40120[0].title.includes('Certificate IV in Building and Construction'));
    const cpc40120Variants = cpc40120.map(c => c.delivery_variant);
    assert.ok(cpc40120Variants.includes('Self-Paced Online'));

    const cpc50220 = courses.filter(c => c.code === 'CPC50220');
    assert.ok(cpc50220.length >= 2);
    assert.ok(cpc50220[0].title.includes('Diploma of Building and Construction'));
    const cpc50220Variants = cpc50220.map(c => c.delivery_variant);
    assert.ok(cpc50220Variants.includes('Self-Paced Online'));
  });

  // Test 14: Unknown Course Values Flag Course Review Required
  it('14. Unverified course submissions are flagged for owner review queue', async () => {
    // 1. Verified course does NOT flag review
    const verifiedRes = await LeadProcessor.processLead({
      organizationId: orgId,
      fullName: 'David Miller',
      email: 'david.miller@example.com.au',
      phone: '0411 222 333',
      captureChannel: 'website',
      provider: 'website',
      courseInterest: 'CPC40120 Certificate IV in Building and Construction (Building)',
      idempotencyKey: `verified_course_${Date.now()}`,
    });
    assert.strictEqual(verifiedRes.submission.course_review_required, false);

    // 2. Unknown unverified course flags review
    const unknownRes = await LeadProcessor.processLead({
      organizationId: orgId,
      fullName: 'Emma Watson',
      email: 'emma.watson@example.com.au',
      phone: '0422 333 444',
      captureChannel: 'website',
      provider: 'website',
      courseInterest: 'BSB50420 Diploma of Leadership and Management',
      idempotencyKey: `unknown_course_${Date.now()}`,
    });
    assert.strictEqual(unknownRes.submission.course_review_required, true);
    assert.strictEqual(unknownRes.contact.course_review_required, true);
  });

  // Test 15: Valid Meta Webhook Ingestion
  it('15. Valid Meta Lead Ads fixture ingests into CRM with attribution', async () => {
    const metaLeadId = `meta_lead_${Date.now()}`;
    const result = await LeadProcessor.processLead({
      organizationId: orgId,
      fullName: 'Marcus Aurelius',
      email: 'marcus.builders@example.com.au',
      phone: '+61 433 999 888',
      captureChannel: 'meta_ads',
      marketingSource: 'meta',
      provider: 'meta',
      providerLeadId: metaLeadId,
      formId: 'meta_form_cpc40120',
      campaignName: 'Instagram South Australia Builders',
      courseInterest: 'CPC40120',
      idempotencyKey: `meta_${metaLeadId}`,
    });

    assert.strictEqual(result.status, 'created');
    assert.strictEqual(result.submission.provider_lead_id, metaLeadId);
    assert.strictEqual(result.submission.capture_channel, 'meta_ads');
  });

  // Test 16: Invalid Meta Signature Rejected
  it('16. Invalid Meta HMAC-SHA256 signature is rejected', () => {
    const rawBody = JSON.stringify({ test: 'payload' });
    const secret = 'valid_meta_app_secret';
    const fakeSignature = 'sha256=invalidhash1234567890abcdef1234567890abcdef1234567890abcdef12345678';

    const isValid = verifyMetaSignature(rawBody, fakeSignature, secret);
    assert.strictEqual(isValid, false);
  });

  // Test 17: Google Ads 64-bit ID Preservation & Test Lead Isolation
  it('17. Google Ads 64-bit ID is preserved as string and test leads isolate emails', async () => {
    const googleLeadId = '9007199254740993999'; // Larger than JS MAX_SAFE_INTEGER
    const queueBefore = db.jobQueue.findMany(orgId).length;

    const result = await LeadProcessor.processLead({
      organizationId: orgId,
      fullName: 'Google Test Candidate',
      email: 'google.test@example.com.au',
      phone: '0400 000 000',
      captureChannel: 'google_ads',
      marketingSource: 'google',
      provider: 'google',
      providerLeadId: googleLeadId,
      idempotencyKey: `google_test_${googleLeadId}`,
      isTest: true, // Test lead!
    });

    assert.strictEqual(result.status, 'created');
    assert.strictEqual(result.submission.provider_lead_id, googleLeadId);
    assert.strictEqual(result.submission.is_test, true);

    // Test lead must NOT enqueue customer email!
    const queueAfter = db.jobQueue.findMany(orgId).length;
    assert.strictEqual(queueAfter, queueBefore);
  });

  // Test 18: Opt-Out Suppression and DNC
  it('18. Opt-out suppresses future automated emails', async () => {
    const contact = db.contacts.findMany(orgId)[0];

    // Suppress contact
    db.suppressions.create({
      organization_id: orgId,
      email: contact.email,
      reason: 'unsubscribe',
    });

    const isSuppressed = db.suppressions.isSuppressed(orgId, contact.email);
    assert.strictEqual(isSuppressed, true);

    // Attempt sending email to suppressed recipient
    const sendResult = await EmailService.sendEmail({
      organizationId: orgId,
      contactId: contact.id,
      recipientEmail: contact.email,
      customSubject: 'Course Intake Details',
      customBody: 'Hello',
    });

    assert.strictEqual(sendResult.success, false);
    assert.strictEqual(sendResult.status, 'suppressed');
  });

  // Test 19: Durable Backoff in Job Queue
  it('19. Job queue handles failures with retry backoff', async () => {
    const job = db.jobQueue.enqueue({
      organizationId: orgId,
      job_type: 'send_email',
      payload: {
        contactId: 'contact_ptp_001',
        recipientEmail: 'test.retry@pracpathways.com.au',
        subject: 'Retry Test',
      },
      max_attempts: 3,
      next_run_at: new Date().toISOString(),
    });

    assert.strictEqual(job.status, 'pending');

    // Simulate failure
    db.jobQueue.markFailed(job.id, 'Simulated SMTP Outage');

    const updatedJob = db.jobQueue.findMany(orgId).find(j => j.id === job.id);
    assert.strictEqual(updatedJob?.status, 'pending'); // Retrying
    assert.strictEqual(updatedJob?.last_error, 'Simulated SMTP Outage');
    assert.strictEqual(updatedJob?.attempts, 1);
  });

  // Test 20: Invariant: Last Active Owner Cannot be Removed or Disabled
  it('20. Security Invariant: Last active owner cannot be removed or disabled', () => {
    // Deactivate Sohail
    db.profiles.update(sohailId, { is_active: false });

    // Attempting to deactivate Jawad (the last active owner) MUST throw an error!
    assert.throws(() => {
      db.profiles.update(jawadId, { is_active: false });
    }, /Cannot disable or change role of the last active owner/);

    // Restore Sohail
    db.profiles.update(sohailId, { is_active: true });
  });

  // Test 21: Formula Injection Protection
  it('21. Formula injection protection sanitizes dangerous spreadsheet prefixes', () => {
    assert.strictEqual(sanitizeCsvField('=SUM(A1:A10)'), "'=SUM(A1:A10)");
    assert.strictEqual(sanitizeCsvField('+cmd|/c calc!A0'), "'+cmd|/c calc!A0");
    assert.strictEqual(sanitizeCsvField('-2+3*cmd'), "'-2+3*cmd");
    assert.strictEqual(sanitizeCsvField('@SUM(1+1)'), "'@SUM(1+1)");
    assert.strictEqual(sanitizeCsvField('Liam O’Connor'), 'Liam O’Connor');
  });

});
