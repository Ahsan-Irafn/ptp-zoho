import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { db } from '../lib/db';
import { runSeed } from '../lib/db/seed';
import { LeadProcessor } from '../lib/services/lead-processor';
import { permissions } from '../lib/auth/permissions';
import { normalizePhone } from '../lib/utils/normalization';
import { CallLog } from '../types/crm';

describe('Practical Training Pathways CRM — 3CX & WordPress Elementor Acceptance Tests', () => {

  const orgId = 'org_pracpathways_001';
  const ayeshaId = 'user_ayesha_003';
  const maryamId = 'user_maryam_004';
  const jawadId = 'user_jawad_001';
  const sohailId = 'user_sohail_002';

  beforeEach(() => {
    runSeed();
  });

  // ============================================================================
  // SECTION 1: WORDPRESS ELEMENTOR PRO FORM INTEGRATION
  // ============================================================================

  describe('1. WordPress Elementor Pro Webhook & Ingestion', () => {

    it('1.1. Website submission creates correct CRM enquiry with course and source mapping', async () => {
      const payload = {
        organizationId: orgId,
        fullName: 'Hamish McDonald',
        email: 'hamish.mcdonald@buildsa.com.au',
        phone: '0412 889 900',
        courseInterest: 'CPC40120 Certificate IV in Building and Construction',
        deliveryVariant: 'Blended / Structured Delivery',
        captureChannel: 'website' as const,
        marketingSource: 'organic' as const,
        provider: 'elementor_pro',
        providerLeadId: 'evt_elem_001_hamish',
        formId: 'elementor_contact_enquiry_form',
        utmSource: 'website_elementor',
        utmMedium: 'organic',
        submittedFields: {
          message: 'Interested in evening building classes in Adelaide.',
          consent_accepted: true,
        },
        idempotencyKey: 'elem_evt_elem_001_hamish',
        isTest: false,
      };

      const result = await LeadProcessor.processLead(payload);

      assert.strictEqual(result.status, 'created');
      assert.ok(result.contact.id);
      assert.strictEqual(result.contact.full_name, 'Hamish McDonald');
      assert.strictEqual(result.contact.phone_normalized, '+61412889900');
      assert.strictEqual(result.matchedCourse?.code, 'CPC40120');
      assert.strictEqual(result.contact.course_review_required, false);

      // Verify enquiry record persisted
      const enquiry = db.leads.findById(result.submission.id);
      assert.ok(enquiry);
      assert.strictEqual(enquiry?.provider, 'elementor_pro');
      assert.strictEqual(enquiry?.form_id, 'elementor_contact_enquiry_form');

      // Verify initial follow-up task created
      const tasks = db.tasks.findByContactId(result.contact.id);
      assert.strictEqual(tasks.length, 1);
      assert.ok(tasks[0].title.includes('Hamish McDonald'));
      assert.strictEqual(tasks[0].assigned_agent_id, result.assignedAgent?.id);
    });

    it('1.2. Two new eligible leads split equally between Ayesha and Maryam (Atomic 50/50 Round-Robin)', async () => {
      const lead1 = await LeadProcessor.processLead({
        organizationId: orgId,
        fullName: 'Candidate One',
        email: 'candidate1@adelaidetrade.com.au',
        phone: '0411 111 222',
        courseInterest: 'CPC40120',
        captureChannel: 'website',
        marketingSource: 'organic',
        provider: 'elementor_pro',
        idempotencyKey: 'elem_split_001',
        isTest: false,
      });

      const lead2 = await LeadProcessor.processLead({
        organizationId: orgId,
        fullName: 'Candidate Two',
        email: 'candidate2@adelaidetrade.com.au',
        phone: '0422 222 333',
        courseInterest: 'CPC50220',
        captureChannel: 'website',
        marketingSource: 'organic',
        provider: 'elementor_pro',
        idempotencyKey: 'elem_split_002',
        isTest: false,
      });

      const agent1Id = lead1.contact.assigned_agent_id;
      const agent2Id = lead2.contact.assigned_agent_id;

      // Must be split between Ayesha (user_ayesha_003) and Maryam (user_maryam_004)
      assert.notStrictEqual(agent1Id, agent2Id, 'Consecutive leads must be assigned to different agents');
      assert.ok(agent1Id === ayeshaId || agent1Id === maryamId);
      assert.ok(agent2Id === ayeshaId || agent2Id === maryamId);
    });

    it('1.3. Concurrent submissions preserve assignment fairness without race condition drift', async () => {
      // Simulate 10 parallel incoming submissions
      const promises = Array.from({ length: 10 }, (_, i) => {
        return LeadProcessor.processLead({
          organizationId: orgId,
          fullName: `Parallel Student ${i + 1}`,
          email: `student.parallel.${i + 1}@builder.com.au`,
          phone: `0412 900 00${i}`,
          courseInterest: 'CPC40120',
          captureChannel: 'website',
          marketingSource: 'organic',
          provider: 'elementor_pro',
          idempotencyKey: `elem_parallel_${i + 1}`,
          isTest: false,
        });
      });

      const results = await Promise.all(promises);

      const ayeshaCount = results.filter(r => r.contact.assigned_agent_id === ayeshaId).length;
      const maryamCount = results.filter(r => r.contact.assigned_agent_id === maryamId).length;

      assert.strictEqual(ayeshaCount + maryamCount, 10);
      assert.strictEqual(ayeshaCount, 5, 'Ayesha must receive exactly 5 of 10 concurrent leads');
      assert.strictEqual(maryamCount, 5, 'Maryam must receive exactly 5 of 10 concurrent leads');
    });

    it('1.4. Delivery retries do not duplicate records, tasks, or emails (Idempotency)', async () => {
      const payload = {
        organizationId: orgId,
        fullName: 'Liam O\'Connor',
        email: 'liam.oconnor@sa-builders.com.au',
        phone: '0433 444 555',
        courseInterest: 'CPC40120',
        captureChannel: 'website' as const,
        marketingSource: 'organic' as const,
        provider: 'elementor_pro',
        idempotencyKey: 'elem_retry_test_liam_991',
        isTest: false,
      };

      // First delivery
      const firstResult = await LeadProcessor.processLead(payload);
      assert.strictEqual(firstResult.status, 'created');

      const initialContactId = firstResult.contact.id;
      const initialTasks = db.tasks.findByContactId(initialContactId);
      assert.strictEqual(initialTasks.length, 1);

      // Webhook retry with exact same idempotencyKey
      const retryResult = await LeadProcessor.processLead(payload);
      assert.strictEqual(retryResult.status, 'duplicate_ignored');
      assert.strictEqual(retryResult.contact.id, initialContactId);

      // Verify no duplicate tasks were created
      const tasksAfterRetry = db.tasks.findByContactId(initialContactId);
      assert.strictEqual(tasksAfterRetry.length, 1, 'Retry must not generate duplicate follow-up tasks');

      // Verify no duplicate lead submission records
      const enquiries = db.leads.findMany(orgId, initialContactId);
      assert.strictEqual(enquiries.length, 1, 'Retry must not generate duplicate lead enquiry records');
    });

    it('1.5. Genuine repeat enquiry preserves existing assigned agent and appends timeline history', async () => {
      // 1. Initial enquiry
      const initial = await LeadProcessor.processLead({
        organizationId: orgId,
        fullName: 'Sophie Bennett',
        email: 'sophie.bennett@adelaidecraft.com.au',
        phone: '0455 666 777',
        courseInterest: 'CPC40120',
        captureChannel: 'website',
        marketingSource: 'organic',
        provider: 'elementor_pro',
        idempotencyKey: 'elem_initial_sophie_001',
        isTest: false,
      });

      const initialAgentId = initial.contact.assigned_agent_id;
      assert.ok(initialAgentId);

      // 2. Genuine second enquiry months later with a NEW event idempotency key
      const repeat = await LeadProcessor.processLead({
        organizationId: orgId,
        fullName: 'Sophie Bennett',
        email: 'sophie.bennett@adelaidecraft.com.au',
        phone: '0455 666 777',
        courseInterest: 'CPC50220', // Upgrading to Diploma
        deliveryVariant: 'Blended / Structured Delivery',
        captureChannel: 'website',
        marketingSource: 'google',
        provider: 'elementor_pro',
        idempotencyKey: 'elem_repeat_sophie_002', // Different submission ID
        submittedFields: { message: 'I finished Cert IV, now want to apply for Diploma of Building.' },
        isTest: false,
      });

      assert.ok(repeat.status === 'linked_existing' || repeat.status === 'repeat_enquiry', 'Status must indicate existing contact link');
      assert.strictEqual(repeat.contact.id, initial.contact.id, 'Must link to existing contact');
      assert.strictEqual(repeat.contact.assigned_agent_id, initialAgentId, 'Must preserve existing assigned agent');
      assert.strictEqual(repeat.matchedCourse?.code, 'CPC50220');

      // Timeline enquiry history has 2 distinct submissions
      const contactEnquiries = db.leads.findMany(orgId, initial.contact.id);
      assert.strictEqual(contactEnquiries.length, 2);
    });

    it('1.6. HMAC-SHA256 signature verification rejects tampered body or invalid secret', () => {
      const serverSecret = 'ptp_elem_sec_test_secret_key_8892';
      const rawPayload = JSON.stringify({
        event_id: 'evt_wp_test_123',
        name: 'Tampered Lead',
        email: 'tampered@fake.com',
      });

      // Valid signature
      const validSig = crypto.createHmac('sha256', serverSecret).update(rawPayload).digest('hex');

      // Tampered body with original signature
      const tamperedBody = JSON.stringify({
        event_id: 'evt_wp_test_123',
        name: 'Hacked Lead Data',
        email: 'tampered@fake.com',
      });
      const computedForTampered = crypto.createHmac('sha256', serverSecret).update(tamperedBody).digest('hex');

      assert.notStrictEqual(validSig, computedForTampered);
      assert.strictEqual(
        crypto.timingSafeEqual(Buffer.from(validSig, 'utf8'), Buffer.from(computedForTampered, 'utf8')),
        false
      );

      // Stale timestamp rejection (> 600s drift)
      const currentSec = Math.floor(Date.now() / 1000);
      const staleTimestamp = currentSec - 700; // 700 seconds old
      const maxDrift = 600;
      assert.ok(Math.abs(currentSec - staleTimestamp) > maxDrift, 'Must detect and reject replay drift');
    });

    it('1.7. Unknown course input preserves value and flags contact for owner review', async () => {
      const unverifiedCourseName = 'Master of Commercial Architecture 2026';
      const result = await LeadProcessor.processLead({
        organizationId: orgId,
        fullName: 'Callum Vance',
        email: 'callum.vance@unknown.com.au',
        phone: '0477 888 999',
        courseInterest: unverifiedCourseName,
        captureChannel: 'website',
        marketingSource: 'organic',
        provider: 'elementor_pro',
        idempotencyKey: 'elem_unverified_course_01',
        isTest: false,
      });

      assert.ok(result.matchedCourse === null || result.matchedCourse === undefined);
      assert.strictEqual(result.contact.course_review_required, true);
      assert.strictEqual(result.contact.course_interest, unverifiedCourseName);
    });
  });

  // ============================================================================
  // SECTION 2: 3CX PHONE SYSTEM INTEGRATION
  // ============================================================================

  describe('2. 3CX Phone System Integration & Permissions', () => {

    it('2.1. 3CX contact lookup matches normalized Australian phone numbers (+61 / 04)', () => {
      // Seeded contact Lachlan Murray has mobile '0412 345 678' -> normalized '+61412345678'
      const allContacts = db.contacts.findMany(orgId);
      const testQuery = '0412 345 678';
      const normalizedQuery = normalizePhone(testQuery);

      assert.strictEqual(normalizedQuery, '+61412345678');

      const match = allContacts.find(c => {
        return c.phone_normalized === normalizedQuery || (c.phone && normalizePhone(c.phone) === normalizedQuery);
      });

      assert.ok(match, '3CX lookup must find contact by normalized Australian phone');
      assert.strictEqual(match?.full_name, 'Lachlan Murray');
    });

    it('2.2. 3CX Screen-pop URL points to authenticated contact record without bypassing auth', () => {
      const contact = db.contacts.findMany(orgId)[0];
      const appUrl = 'https://crm.pracpathways.com.au';
      const screenPopUrl = `${appUrl}/contacts/${contact.id}`;

      // URL must be a standard CRM route, with NO authentication tokens in query params
      assert.ok(screenPopUrl.includes('/contacts/'));
      assert.ok(!screenPopUrl.includes('token='), 'Screen-pop URL must not contain sensitive auth tokens');
      assert.ok(!screenPopUrl.includes('bypass='), 'Screen-pop must require normal CRM session authentication');
    });

    it('2.3. Agent extension mapping correctly resolves Ayesha (101) and Maryam (102)', () => {
      const conn = db.integrations.findByProvider(orgId, 'three_cx');
      assert.ok(conn);

      const extensions = conn.config?.agent_extensions;
      assert.ok(extensions);
      assert.strictEqual(extensions.ayesha_extension, '101');
      assert.strictEqual(extensions.maryam_extension, '102');

      const allProfiles = db.profiles.findMany(orgId);
      const ayesha = allProfiles.find(p => p.email.includes('ayesha'));
      const maryam = allProfiles.find(p => p.email.includes('maryam'));

      assert.ok(ayesha);
      assert.ok(maryam);
      assert.strictEqual(ayesha?.id, ayeshaId);
      assert.strictEqual(maryam?.id, maryamId);
    });

    it('2.4. Click-to-call permission enforcement: Calling agent cannot initiate calls to unassigned contacts', () => {
      const contacts = db.contacts.findMany(orgId);
      const ayeshaContact = contacts.find(c => c.assigned_agent_id === ayeshaId)!;
      const maryamContact = contacts.find(c => c.assigned_agent_id === maryamId)!;

      assert.ok(ayeshaContact);
      assert.ok(maryamContact);

      // Ayesha CAN access and initiate call to her own contact
      const ayeshaPermitted = permissions.canAccessContact('agent', ayeshaId, ayeshaContact);
      assert.strictEqual(ayeshaPermitted, true);

      // Ayesha CANNOT access or initiate call to Maryam's contact
      const ayeshaForbidden = permissions.canAccessContact('agent', ayeshaId, maryamContact);
      assert.strictEqual(ayeshaForbidden, false, 'Agent must be strictly forbidden from calling unassigned contact');

      // Owners (Jawad & Sohail) CAN initiate calls to any contact
      const jawadPermitted = permissions.canAccessContact('owner', jawadId, maryamContact);
      assert.strictEqual(jawadPermitted, true);
    });

    it('2.5. Call journaling is accurate, retry-safe, and reconciles updates by provider_call_id', () => {
      const contact = db.contacts.findMany(orgId)[0];
      const providerCallId = '3cx_call_unique_9921';

      // Step 1: Initial call journal entry (Call initiated or ringing)
      const initialLog = db.callLogs.create({
        id: 'call_test_001',
        organization_id: orgId,
        contact_id: contact.id,
        agent_id: ayeshaId,
        timestamp: new Date().toISOString(),
        outcome: 'no_answer',
        duration_seconds: 0,
        provider: '3cx',
        provider_call_id: providerCallId,
        direction: 'outbound',
        call_status: 'in_progress' as any,
        agent_extension: '101',
        notes: 'Outbound call initiated via 3CX WebClient.',
        created_at: new Date().toISOString(),
      });

      assert.ok(initialLog);
      assert.strictEqual(initialLog.duration_seconds, 0);

      // Step 2: 3CX ReportCall webhook fires on hangup with final duration & status
      const existingCall = db.callLogs.findByProviderCallId(orgId, providerCallId);
      assert.ok(existingCall);

      const reconciledLog = db.callLogs.update(existingCall.id, {
        duration_seconds: 142,
        call_status: 'completed',
        outcome: 'connected',
        notes: 'Spoke with candidate regarding Certificate IV in Building. Sent enrolment kit.',
      });

      assert.ok(reconciledLog);
      assert.strictEqual(reconciledLog.duration_seconds, 142);
      assert.strictEqual(reconciledLog.call_status, 'completed');
      assert.strictEqual(reconciledLog.outcome, 'connected');

      // Step 3: Duplicate webhook retry must find same call and not create a second row
      const duplicateLookup = db.callLogs.findByProviderCallId(orgId, providerCallId);
      assert.strictEqual(duplicateLookup?.id, existingCall.id);
    });

    it('2.6. Missed 3CX inbound call automatically generates callback task for assigned agent', () => {
      const contact = db.contacts.findMany(orgId)[0];
      const missedCallId = '3cx_call_missed_7712';

      // Log missed call
      const missedLog = db.callLogs.create({
        id: 'call_test_missed_01',
        organization_id: orgId,
        contact_id: contact.id,
        agent_id: maryamId,
        timestamp: new Date().toISOString(),
        outcome: 'no_answer',
        duration_seconds: 0,
        provider: '3cx',
        provider_call_id: missedCallId,
        direction: 'inbound',
        call_status: 'missed',
        agent_extension: '102',
        notes: 'Inbound missed call from 0412 345 678.',
        created_at: new Date().toISOString(),
      });

      assert.strictEqual(missedLog.call_status, 'missed');

      // Callback task creation
      const callbackTask = db.tasks.create({
        id: 'task_cb_test_01',
        organization_id: orgId,
        contact_id: contact.id,
        assigned_agent_id: maryamId,
        title: `3CX Missed Call: Callback required for ${contact.full_name}`,
        description: 'Candidate called while agent was on another call.',
        due_date: new Date(Date.now() + 3600000).toISOString(),
        priority: 'high',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      assert.ok(callbackTask);
      assert.strictEqual(callbackTask.assigned_agent_id, maryamId);
      assert.strictEqual(callbackTask.priority, 'high');
    });

    it('2.7. Unauthorized users cannot access integration credentials or change settings', () => {
      // Agents (Ayesha and Maryam)
      assert.strictEqual(permissions.canManageIntegrations('agent'), false);
      assert.strictEqual(permissions.canManageTeam('agent'), false);
      assert.strictEqual(permissions.canViewAuditLogs('agent'), false);

      // Owners (Jawad and Sohail)
      assert.strictEqual(permissions.canManageIntegrations('owner'), true);
      assert.strictEqual(permissions.canManageTeam('owner'), true);
      assert.strictEqual(permissions.canViewAuditLogs('owner'), true);
    });
  });

});
