import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { db } from '../lib/db';
import { runSeed } from '../lib/db/seed';
import { sanitizeRecordForRole } from '../lib/db';
import { LeadProcessor } from '../lib/services/lead-processor';
import { EmailService } from '../lib/services/email-service';
import { FieldDefinition, ModuleDefinition } from '../types/crm';

describe('Owner Access, Module Builder & Custom Fields Acceptance Suite', () => {

  beforeEach(() => {
    // Reset clean seed state before each test
    runSeed();
  });

  const orgId = 'org_pracpathways_001';
  const jawadId = 'user_jawad_001';
  const sohailId = 'user_sohail_002';
  const ayeshaId = 'user_ayesha_003';
  const maryamId = 'user_maryam_004';

  // -------------------------------------------------------------
  // 1. FULL OWNER ACCESS (Jawad and Sohail)
  // -------------------------------------------------------------
  it('1. Jawad and Sohail have equal organization-wide access to all records, including unassigned and archived', () => {
    // Both Jawad and Sohail are owners
    const jawad = db.users.findById(jawadId)!;
    const sohail = db.users.findById(sohailId)!;
    assert.strictEqual(jawad.role, 'owner');
    assert.strictEqual(sohail.role, 'owner');

    // Jawad sees all active contacts + can fetch archived
    const allActiveJawad = db.contacts.findMany(orgId);
    assert.ok(allActiveJawad.length >= 5, 'Owners must see all active contacts across both advisors');

    // Verify unassigned contact is visible to owners
    const unassignedContact = db.contacts.findById('contact_005');
    assert.ok(unassignedContact, 'Unassigned contact must be retrievable');
    assert.strictEqual(unassignedContact?.assigned_agent_id, undefined);

    // Verify archived contact is retrievable by owners
    const archivedContacts = db.contacts.findMany(orgId, { isArchived: true });
    const archivedItem = archivedContacts.find(c => c.id === 'contact_006');
    assert.ok(archivedItem, 'Archived contact must be retrievable by owners');
    assert.strictEqual(archivedItem.is_archived, true);

    // Sohail has identical visibility
    const allActiveSohail = db.contacts.findMany(orgId);
    assert.strictEqual(allActiveSohail.length, allActiveJawad.length);
  });

  it('2. Owners can view Ayesha\'s leads, Maryam\'s leads, and unassigned leads via agentFilter', () => {
    // Ayesha's leads
    const ayeshaLeads = db.contacts.findMany(orgId, { agentId: ayeshaId });
    assert.ok(ayeshaLeads.length > 0, 'Ayesha must have assigned leads');
    assert.ok(ayeshaLeads.every(c => c.assigned_agent_id === ayeshaId));

    // Maryam's leads
    const maryamLeads = db.contacts.findMany(orgId, { agentId: maryamId });
    assert.ok(maryamLeads.length > 0, 'Maryam must have assigned leads');
    assert.ok(maryamLeads.every(c => c.assigned_agent_id === maryamId));

    // Unassigned leads
    const unassignedLeads = db.contacts.findMany(orgId, { agentFilter: 'unassigned' });
    assert.ok(unassignedLeads.length > 0, 'Unassigned leads must be retrievable');
    assert.ok(unassignedLeads.every(c => !c.assigned_agent_id));
  });

  it('3. Owners can reassign, archive, and restore records across the organization', () => {
    // Reassign contact_001 from Ayesha to Maryam
    const initialContact = db.contacts.findById('contact_001')!;
    const initialAgent = initialContact.assigned_agent_id;

    const reassigned = db.contacts.reassign('contact_001', maryamId, jawadId, 'Muhammad Jawad');
    assert.strictEqual(reassigned?.assigned_agent_id, maryamId);

    // Verify associated open deals were reassigned too
    const deals = db.deals.findByContactId('contact_001');
    assert.ok(deals.length > 0);
    assert.ok(deals.every(d => d.assigned_agent_id === maryamId));

    // Archive contact
    const archived = db.contacts.archive('contact_001', jawadId, 'Muhammad Jawad');
    assert.strictEqual(archived?.is_archived, true);
    assert.strictEqual(archived?.lifecycle_status, 'archived');

    // Restore contact
    const restored = db.contacts.restore('contact_001', sohailId, 'Sohail Sadiq');
    assert.strictEqual(restored?.is_archived, false);
    assert.strictEqual(restored?.lifecycle_status, 'lead');
  });

  // -------------------------------------------------------------
  // 2. CALLING AGENT ISOLATION & RESTRICTIONS (Ayesha and Maryam)
  // -------------------------------------------------------------
  it('4. Calling agents are strictly isolated to their own assigned records and cannot see unassigned/archived', () => {
    // Ayesha's view
    const ayeshaContacts = db.contacts.findMany(orgId, { agentId: ayeshaId });
    assert.ok(ayeshaContacts.length > 0);
    assert.ok(ayeshaContacts.every(c => c.assigned_agent_id === ayeshaId));
    assert.ok(ayeshaContacts.every(c => !c.is_archived));

    // Ayesha attempting to findById a Maryam contact or unassigned contact returns undefined
    const maryamContact = db.contacts.findMany(orgId, { agentId: maryamId })[0];
    const forbiddenLookup = db.contacts.findById(maryamContact.id, ayeshaId);
    assert.strictEqual(forbiddenLookup, undefined, 'Ayesha cannot access Maryam\'s contact');

    const unassignedLookup = db.contacts.findById('contact_005', ayeshaId);
    assert.strictEqual(unassignedLookup, undefined, 'Ayesha cannot access unassigned contact');
  });

  // -------------------------------------------------------------
  // 3. OWNER-ONLY MODULE BUILDER
  // -------------------------------------------------------------
  it('5. Owners can create, update, and manage custom modules', () => {
    // Create new module "Apprenticeships"
    const newModule = db.modules.create({
      organization_id: orgId,
      key: 'apprenticeships',
      name: 'Apprenticeships & Traineeships',
      singular_name: 'Apprenticeship',
      description: 'Host employer agreements and school-based trade traineeships.',
      icon: 'Briefcase',
      sidebar_position: 9,
      is_enabled: true,
      agent_access: 'none', // Default owner-only
      table_columns: ['apprentice_name', 'employer_name', 'qualification', 'commencement_date'],
    }, jawadId, 'Muhammad Jawad');

    assert.ok(newModule.id);
    assert.strictEqual(newModule.key, 'apprenticeships');
    assert.strictEqual(newModule.is_system, false);
    assert.strictEqual(newModule.agent_access, 'none');

    // Verify it is retrievable
    const retrieved = db.modules.findByKey(orgId, 'apprenticeships');
    assert.ok(retrieved);
    assert.strictEqual(retrieved?.name, 'Apprenticeships & Traineeships');

    // Update module
    const updated = db.modules.update(orgId, 'apprenticeships', {
      agent_access: 'assigned_only',
      description: 'Updated description for apprenticeships.'
    }, sohailId, 'Sohail Sadiq');

    assert.strictEqual(updated?.agent_access, 'assigned_only');
    assert.strictEqual(updated?.description, 'Updated description for apprenticeships.');
  });

  it('6. System modules (contacts, leads, deals, tasks, courses) are protected from deletion', () => {
    // Attempting to archive or delete a system module must throw
    assert.throws(() => {
      db.modules.archive(orgId, 'contacts', jawadId, 'Muhammad Jawad');
    }, /Protected system modules cannot be disabled or archived/);

    assert.throws(() => {
      db.modules.archive(orgId, 'leads', sohailId, 'Sohail Sadiq');
    }, /Protected system modules cannot be disabled or archived/);
  });

  // -------------------------------------------------------------
  // 4. CUSTOM RECORDS CRUD
  // -------------------------------------------------------------
  it('7. Custom module supports real record creation, retrieval, editing, and archiving', () => {
    // Create record in the seeded 'employers' module
    const employerRecord = db.customRecords.create({
      organization_id: orgId,
      module_key: 'employers',
      title: 'South Coast Carpentry & Framing Pty Ltd',
      assigned_agent_id: ayeshaId,
      data: {
        company_name: 'South Coast Carpentry & Framing Pty Ltd',
        primary_contact: 'Liam O\'Connor',
        contact_email: 'liam@southcoastcarpentry.com.au',
        contact_phone: '0412 888 999',
        industry_sector: 'Residential Carpentry'
      }
    }, jawadId, 'Muhammad Jawad');

    assert.ok(employerRecord.id);
    assert.strictEqual(employerRecord.title, 'South Coast Carpentry & Framing Pty Ltd');

    // Retrieve records
    const list = db.customRecords.findMany(orgId, 'employers');
    const found = list.find(r => r.id === employerRecord.id);
    assert.ok(found);
    assert.strictEqual(found?.data.primary_contact, 'Liam O\'Connor');

    // Edit record
    const updated = db.customRecords.update(employerRecord.id, {
      title: 'South Coast Carpentry (Updated)',
      data: {
        ...employerRecord.data,
        primary_contact: 'Liam O\'Connor (Managing Director)'
      }
    }, sohailId, 'Sohail Sadiq');

    assert.strictEqual(updated?.title, 'South Coast Carpentry (Updated)');
    assert.strictEqual(updated?.data.primary_contact, 'Liam O\'Connor (Managing Director)');

    // Archive record
    const archived = db.customRecords.archive(employerRecord.id, jawadId, 'Muhammad Jawad');
    assert.strictEqual(archived?.is_archived, true);
  });

  // -------------------------------------------------------------
  // 5. FIELD BUILDER & FIELD VALIDATION
  // -------------------------------------------------------------
  it('8. Owners can define custom fields with stable keys and validation', () => {
    // Add custom field to contacts
    const fieldDef = db.fields.create({
      organization_id: orgId,
      module_key: 'contacts',
      field_key: 'adelaide_metro_region',
      label: 'Adelaide Metro Region',
      field_type: 'single_select',
      help_text: 'Geographic sub-region in Greater Adelaide for in-person trade workshop allocation.',
      is_required: false,
      options: [
        { label: 'North / Playford', value: 'North' },
        { label: 'South / Onkaparinga', value: 'South' },
        { label: 'East / Norwood', value: 'East' },
        { label: 'West / Port Adelaide', value: 'West' },
        { label: 'Adelaide Hills', value: 'Hills' }
      ],
      section: 'Location & Campus',
      display_order: 10,
      show_in_form: true,
      show_in_table: true,
      show_in_detail: true,
      is_owner_only_view: false,
      is_owner_only_edit: false
    }, jawadId, 'Muhammad Jawad');

    assert.ok(fieldDef.id);
    assert.strictEqual(fieldDef.field_key, 'adelaide_metro_region');

    // Test field value validation
    const validResult = db.fields.validateFieldValue(fieldDef, 'North');
    assert.strictEqual(validResult.valid, true);

    const invalidResult = db.fields.validateFieldValue(fieldDef, 'InvalidRegion');
    assert.strictEqual(invalidResult.valid, false);
  });

  it('9. Renaming a field display label preserves the internal field key and existing values', () => {
    const existing = db.fields.findByKey(orgId, 'contacts', 'funding_eligibility')!;
    assert.ok(existing);
    const originalKey = existing.field_key;

    // Update label safely
    const updated = db.fields.update(orgId, existing.id, {
      label: 'SA Government Construction Subsidy Status'
    });

    assert.strictEqual(updated?.label, 'SA Government Construction Subsidy Status');
    assert.strictEqual(updated?.field_key, originalKey, 'Internal field key must remain stable');

    // Verify existing contact values are intact under the same key
    const contact = db.contacts.findById('contact_001')!;
    assert.strictEqual(contact.custom_fields?.funding_eligibility, 'Eligible');
  });

  // -------------------------------------------------------------
  // 6. SERVER-SIDE FIELD-LEVEL SECURITY & REDACTION
  // -------------------------------------------------------------
  it('10. Field-level server authorization strictly redacts owner-only fields from calling agent payloads', () => {
    const fieldDefs = db.fields.findMany(orgId, 'contacts');
    const contact = db.contacts.findById('contact_001')!;

    // Ensure contact has owner financial notes
    assert.ok(contact.custom_fields?.owner_financial_notes, 'Seeded contact has owner financial notes');

    // 1. Sanitize for Owner (Jawad or Sohail)
    const ownerPayload = sanitizeRecordForRole('contacts', contact, 'owner', fieldDefs);
    assert.ok(ownerPayload.custom_fields?.owner_financial_notes, 'Owner must receive owner financial notes');

    // 2. Sanitize for Calling Agent (Ayesha or Maryam)
    const agentPayload = sanitizeRecordForRole('contacts', contact, 'agent', fieldDefs);
    assert.strictEqual(
      agentPayload.custom_fields?.owner_financial_notes,
      undefined,
      'Owner-only field must be completely absent from agent payload'
    );
    // Permitted custom fields should still be present
    assert.strictEqual(agentPayload.custom_fields?.funding_eligibility, 'Eligible');
  });

  // -------------------------------------------------------------
  // 7. DEPENDENCY CHECKS BEFORE ARCHIVING FIELDS
  // -------------------------------------------------------------
  it('11. Dependency check detects historical usage before archiving a field', () => {
    const field = db.fields.findByKey(orgId, 'contacts', 'funding_eligibility')!;
    assert.ok(field);

    const depCheck = db.fields.checkDependencies(orgId, field.module_key, field.field_key);
    assert.ok(depCheck.recordCount > 0, 'Must detect existing records using this field');

    // Archiving preserves historical data in records
    db.fields.archive(orgId, field.id);
    const contact = db.contacts.findById('contact_001')!;
    assert.strictEqual(contact.custom_fields?.funding_eligibility, 'Eligible', 'Historical data must be preserved');
  });

  // -------------------------------------------------------------
  // 8. ELEMENTOR WEBHOOK LEAD INGESTION WITH CUSTOM FIELDS
  // -------------------------------------------------------------
  it('12. Elementor lead submission ingests and validates custom fields into Contact and Touchpoint', async () => {
    const submissionPayload = {
      organizationId: orgId,
      fullName: 'Nathan Brooks',
      email: 'nathan.brooks@adelaideframing.com.au',
      phone: '0423 777 888',
      courseInterest: 'CPC40120 Certificate IV in Building and Construction (Building)',
      deliveryVariant: 'Self-Paced Online',
      captureChannel: 'website' as const,
      marketingSource: 'elementor_form' as any,
      provider: 'website',
      formId: 'ptp_trade_enquiry_2026',
      submittedFields: {
        funding_eligibility: 'Eligible',
        student_usi: 'USI987654321',
        prior_education_level: 'Year 12 or Trade Certificate',
        white_card_holder: 'true'
      }
    };

    const result = await LeadProcessor.processLead(submissionPayload);
    assert.strictEqual(result.status, 'created');
    assert.ok(result.contact.id);

    // Verify contact custom_fields
    const contact = db.contacts.findById(result.contact.id)!;
    assert.strictEqual(contact.custom_fields?.funding_eligibility, 'Eligible');
    assert.strictEqual(contact.custom_fields?.student_usi, 'USI987654321');
    assert.strictEqual(contact.custom_fields?.white_card_holder, true);

    // Verify lead submission touchpoint custom_fields
    const lead = db.leads.findById(result.submission.id)!;
    assert.strictEqual(lead.custom_fields?.funding_eligibility, 'Eligible');
    assert.strictEqual(lead.custom_fields?.student_usi, 'USI987654321');
  });

  // -------------------------------------------------------------
  // 9. EMAIL TEMPLATE VARIABLES WITH CUSTOM FIELDS
  // -------------------------------------------------------------
  it('13. Email template variables resolve custom fields and suppress owner-only fields', () => {
    const contact = db.contacts.findById('contact_001')!;

    // Template referencing standard fields, custom field, and owner-only field
    const template = 'Hi {{first_name}}, your subsidy status is {{custom.funding_eligibility}}. Private notes: {{custom.owner_financial_notes}}';

    // Agent rendering: owner-only custom field is redacted/empty
    const renderedForAgent = EmailService.renderTemplateForContact(template, contact, orgId, 'agent');
    assert.ok(renderedForAgent.includes('Hi Lachlan'));
    assert.ok(renderedForAgent.includes('your subsidy status is Eligible'));
    assert.ok(!renderedForAgent.includes('Approved payment plan'), 'Owner notes must not appear in agent email');

    // Owner rendering: owner field is resolved
    const renderedForOwner = EmailService.renderTemplateForContact(template, contact, orgId, 'owner');
    assert.ok(renderedForOwner.includes('Approved payment plan'));
  });

});
