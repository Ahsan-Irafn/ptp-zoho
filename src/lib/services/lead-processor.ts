import { db } from '@/lib/db';
import { normalizeEmail, normalizePhone } from '@/lib/utils/normalization';
import { 
  CaptureChannel, 
  MarketingSource, 
  Contact, 
  LeadSubmission, 
  JobQueueItem, 
  Profile,
  Deal,
  Course
} from '@/types/crm';

export interface IngestLeadPayload {
  organizationId?: string;
  fullName: string;
  email: string;
  phone?: string;
  company?: string;
  city?: string;
  country?: string;
  stateOrPostcode?: string;
  courseInterest?: string;
  deliveryVariant?: string;
  captureChannel: CaptureChannel;
  marketingSource?: MarketingSource;
  provider: string; // 'website' | 'meta' | 'google' | 'csv' | 'manual'
  providerLeadId?: string;
  formId?: string;
  campaignId?: string;
  campaignName?: string;
  adSetId?: string;
  adId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
  fbclid?: string;
  landingPage?: string;
  referrer?: string;
  submittedFields?: Record<string, any>;
  consentText?: string;
  consentTimestamp?: string;
  rawPayload?: Record<string, any>;
  idempotencyKey?: string;
  isTest?: boolean;
}

export interface IngestResult {
  status: 'created' | 'linked_existing' | 'duplicate_ignored' | 'conflict_flagged';
  contact: Contact;
  submission: LeadSubmission;
  assignedAgent?: Profile | null;
  matchedCourse?: Course | null;
  message: string;
}

export class LeadProcessor {
  /**
   * Process and ingest an incoming lead atomically
   */
  public static async processLead(payload: IngestLeadPayload): Promise<IngestResult> {
    const org = payload.organizationId 
      ? db.organizations.findById(payload.organizationId) 
      : db.organizations.findFirst();

    if (!org) {
      throw new Error('Organization not found for lead ingestion');
    }

    const orgId = org.id;
    const normEmail = normalizeEmail(payload.email);
    const normPhone = payload.phone ? normalizePhone(payload.phone, '+61') : undefined;

    // Generate durable idempotency key if not provided
    const idempotencyKey = payload.idempotencyKey || 
      (payload.providerLeadId 
        ? `${payload.provider}_${payload.providerLeadId}` 
        : `${payload.provider}_${normEmail}_${normPhone || ''}_${Date.now()}`);

    // =========================================================================
    // CASE A: Provider Retry Defense (Idempotency)
    // A provider retry must NOT advance the round-robin rotation or send duplicates
    // =========================================================================
    const existingSubmission = db.leads.findByIdempotencyKey(orgId, idempotencyKey);
    if (existingSubmission) {
      const existingContact = db.contacts.findById(existingSubmission.contact_id);
      return {
        status: 'duplicate_ignored',
        contact: existingContact!,
        submission: existingSubmission,
        message: 'Duplicate provider webhook delivery ignored safely without side effects.',
      };
    }

    // =========================================================================
    // Course Verification & Review Queue Handling
    // =========================================================================
    const rawCourseInput = (
      payload.courseInterest || 
      payload.submittedFields?.course_interest || 
      payload.submittedFields?.courseInterest || 
      payload.submittedFields?.course || 
      ''
    ).toString().trim();

    const officialCourses = db.courses.findMany(orgId, false);
    let matchedCourse: Course | null = null;
    let courseReviewRequired = false;

    if (rawCourseInput) {
      const upper = rawCourseInput.toUpperCase();
      if (upper.includes('CPC40120') || (upper.includes('CERTIFICATE IV') && upper.includes('BUILDING'))) {
        matchedCourse = officialCourses.find(c => c.code === 'CPC40120') || null;
      } else if (upper.includes('CPC50220') || (upper.includes('DIPLOMA') && upper.includes('BUILDING'))) {
        matchedCourse = officialCourses.find(c => c.code === 'CPC50220') || null;
      } else {
        // Direct code match fallback
        matchedCourse = officialCourses.find(c => upper.includes(c.code.toUpperCase())) || null;
      }

      // If course is specified but not in verified business catalogue: enter owner review queue
      if (!matchedCourse) {
        courseReviewRequired = true;
      }
    }

    // Detect delivery variant
    let deliveryVariant = payload.deliveryVariant || payload.submittedFields?.delivery_variant;
    if (!deliveryVariant && rawCourseInput) {
      if (/self[- ]?paced|online/i.test(rawCourseInput) || /self[- ]?paced|online/i.test(payload.submittedFields?.message || '')) {
        deliveryVariant = 'Self-Paced Online';
      } else {
        deliveryVariant = 'Blended / Structured Delivery';
      }
    }

    // =========================================================================
    // Deduplication Search
    // =========================================================================
    const matchResult = db.contacts.findByNormalizedEmailOrPhone(orgId, normEmail, normPhone);

    const now = new Date().toISOString();
    let contact: Contact;
    let assignedAgent: Profile | null = null;
    let isNewContact = false;
    let statusResult: IngestResult['status'] = 'created';

    if (matchResult.matchedBy === 'conflict') {
      // Conflicting identity detected! Email belongs to Contact A, but Phone belongs to Contact B
      contact = matchResult.contact!;
      statusResult = 'conflict_flagged';
      
      db.contacts.update(contact.id, {
        conflict_flag: true,
        conflict_details: `Conflict: Submitted phone ${normPhone} matches existing contact '${matchResult.conflictContact?.full_name}' (${matchResult.conflictContact?.email}). Flagged for owner review.`,
        latest_enquiry_at: now,
      });

      // Notify owners of conflicting identity
      const owners = db.profiles.findMany(orgId).filter(p => p.role === 'owner' && p.is_active);
      owners.forEach(owner => {
        db.notifications.create({
          organization_id: orgId,
          user_id: owner.id,
          title: '⚠️ Conflicting Contact Match Flagged',
          message: `Submission from ${payload.fullName} has email matching ${contact.email} but phone matching ${matchResult.conflictContact?.email}.`,
          link: `/contacts/${contact.id}`,
          type: 'integration_alert',
        });
      });

    } else if (matchResult.contact) {
      // =========================================================================
      // CASE B: Genuine Repeat Enquiry from Existing Person
      // Keep existing active agent and record this separately from new lead rotation
      // =========================================================================
      contact = matchResult.contact;
      statusResult = 'linked_existing';

      // Preserve active assigned agent unless unassigned
      if (contact.assigned_agent_id) {
        assignedAgent = db.profiles.findById(contact.assigned_agent_id) || null;
      } else {
        assignedAgent = db.organizations.getNextRoundRobinAgent(orgId);
      }

      // Extract and validate custom fields configured on contacts module
      const contactFieldDefs = db.fields.findMany(orgId, 'contacts');
      const customFieldValues: Record<string, any> = {};

      if (payload.submittedFields && typeof payload.submittedFields === 'object') {
        for (const field of contactFieldDefs) {
          const val = payload.submittedFields[field.field_key] ?? 
                      payload.submittedFields[field.label] ??
                      payload.submittedFields[field.field_key.toLowerCase()];
          if (val !== undefined && val !== null && val !== '') {
            const validation = db.fields.validateFieldValue(field, val);
            if (validation.valid) {
              if (field.field_type === 'checkbox') {
                customFieldValues[field.field_key] = val === true || val === 'true' || val === '1' || val === 'yes';
              } else {
                customFieldValues[field.field_key] = val;
              }
            }
          }
        }
      }

      // Update contact metadata
      const updates: Partial<Contact> = {
        latest_enquiry_at: now,
        assigned_agent_id: assignedAgent ? assignedAgent.id : contact.assigned_agent_id,
      };

      if (!contact.company && payload.company) updates.company = payload.company;
      if (!contact.city && payload.city) updates.city = payload.city;
      if (payload.stateOrPostcode) updates.state_or_postcode = payload.stateOrPostcode;
      if (matchedCourse) {
        updates.course_interest = matchedCourse.title;
        updates.delivery_variant = deliveryVariant;
      }
      if (courseReviewRequired) {
        updates.course_review_required = true;
      }
      if (Object.keys(customFieldValues).length > 0) {
        updates.custom_fields = { ...(contact.custom_fields || {}), ...customFieldValues };
      }

      db.contacts.update(contact.id, updates);

    } else {
      // =========================================================================
      // New Contact Creation & Strict Atomic Round-Robin Assignment
      // =========================================================================
      isNewContact = true;
      assignedAgent = db.organizations.getNextRoundRobinAgent(orgId);

      // Extract and validate custom fields for new contact
      const contactFieldDefs = db.fields.findMany(orgId, 'contacts');
      const customFieldValues: Record<string, any> = {};

      if (payload.submittedFields && typeof payload.submittedFields === 'object') {
        for (const field of contactFieldDefs) {
          const val = payload.submittedFields[field.field_key] ?? 
                      payload.submittedFields[field.label] ??
                      payload.submittedFields[field.field_key.toLowerCase()];
          if (val !== undefined && val !== null && val !== '') {
            const validation = db.fields.validateFieldValue(field, val);
            if (validation.valid) {
              if (field.field_type === 'checkbox') {
                customFieldValues[field.field_key] = val === true || val === 'true' || val === '1' || val === 'yes';
              } else {
                customFieldValues[field.field_key] = val;
              }
            }
          }
        }
      }

      // If no agent eligible, keep in unassigned queue and notify owners
      if (!assignedAgent) {
        const owners = db.profiles.findMany(orgId).filter(p => p.role === 'owner' && p.is_active);
        owners.forEach(owner => {
          db.notifications.create({
            organization_id: orgId,
            user_id: owner.id,
            title: '⚠️ Unassigned Lead in Queue',
            message: `New enquiry from ${payload.fullName} could not be assigned because no calling agents are active.`,
            link: '/contacts',
            type: 'system',
          });
        });
      }

      const newContactId = `contact_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      contact = db.contacts.create({
        id: newContactId,
        organization_id: orgId,
        full_name: payload.fullName,
        email: payload.email,
        email_normalized: normEmail,
        phone_raw: payload.phone,
        phone_normalized: normPhone,
        company: payload.company,
        city: payload.city,
        country: payload.country || 'Australia',
        state_or_postcode: payload.stateOrPostcode,
        course_interest: matchedCourse ? matchedCourse.title : (rawCourseInput || undefined),
        delivery_variant: deliveryVariant,
        course_review_required: courseReviewRequired,
        tags: [payload.captureChannel, payload.marketingSource || 'unknown'].filter(Boolean),
        assigned_agent_id: assignedAgent ? assignedAgent.id : undefined,
        lifecycle_status: 'lead',
        first_enquiry_at: now,
        latest_enquiry_at: now,
        do_not_call: false,
        email_suppressed: false,
        communication_preferences: { email: true, phone: true },
        conflict_flag: false,
        custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
        created_at: now,
        updated_at: now,
      });

      // Create Education-Focused Course Enquiry Pipeline Entry
      const dealTitle = matchedCourse 
        ? `${matchedCourse.code} Enquiry — ${contact.full_name}`
        : `Building & Construction Enquiry — ${contact.full_name}`;

      db.deals.create({
        id: `deal_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        organization_id: orgId,
        contact_id: contact.id,
        assigned_agent_id: assignedAgent ? assignedAgent.id : undefined,
        title: dealTitle,
        stage: 'new_enquiry',
        course_code: matchedCourse?.code,
        course_title: matchedCourse?.title,
        delivery_variant: deliveryVariant,
        notes: payload.submittedFields?.message ? `Initial message: ${payload.submittedFields.message}` : undefined,
        created_at: now,
        updated_at: now,
      });
    }

    // =========================================================================
    // Create Lead Submission Touchpoint
    // =========================================================================
    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const submission = db.leads.create({
      id: submissionId,
      organization_id: orgId,
      contact_id: contact.id,
      capture_channel: payload.captureChannel,
      marketing_source: payload.marketingSource || 'unknown',
      provider: payload.provider,
      provider_lead_id: payload.providerLeadId,
      form_id: payload.formId,
      campaign_id: payload.campaignId,
      campaign_name: payload.campaignName,
      ad_set_id: payload.adSetId,
      ad_id: payload.adId,
      course_interest: matchedCourse ? matchedCourse.title : (rawCourseInput || undefined),
      delivery_variant: deliveryVariant,
      state_or_postcode: payload.stateOrPostcode,
      course_review_required: courseReviewRequired,
      utm_source: payload.utmSource,
      utm_medium: payload.utmMedium,
      utm_campaign: payload.utmCampaign,
      utm_term: payload.utmTerm,
      utm_content: payload.utmContent,
      gclid: payload.gclid,
      fbclid: payload.fbclid,
      landing_page: payload.landingPage,
      referrer: payload.referrer,
      submitted_fields: payload.submittedFields || {},
      custom_fields: contact.custom_fields || undefined,
      consent_text: payload.consentText,
      consent_timestamp: payload.consentTimestamp,
      raw_payload: payload.rawPayload || {},
      idempotency_key: idempotencyKey,
      is_test: !!payload.isTest,
      submission_timestamp: now,
      processed_at: now,
      created_at: now,
    });

    // Notify owners if unknown course was submitted
    if (courseReviewRequired) {
      const owners = db.profiles.findMany(orgId).filter(p => p.role === 'owner' && p.is_active);
      owners.forEach(owner => {
        db.notifications.create({
          organization_id: orgId,
          user_id: owner.id,
          title: '📋 Unknown Course Enquiry Review',
          message: `${contact.full_name} enquired with unrecognised course value "${rawCourseInput}". Review required.`,
          link: `/contacts/${contact.id}`,
          type: 'system',
        });
      });
    }

    // Create Initial Task for Assigned Agent
    if (assignedAgent) {
      db.tasks.create({
        id: `task_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        organization_id: orgId,
        contact_id: contact.id,
        assigned_agent_id: assignedAgent.id,
        title: `Initial Call: ${contact.full_name} (${matchedCourse?.code || 'Course Enquiry'})`,
        description: `Review enquiry from ${payload.captureChannel}. Phone: ${contact.phone_raw || 'N/A'}. Course: ${matchedCourse?.title || rawCourseInput || 'Building & Construction'}.`,
        due_date: new Date(Date.now() + 3600000 * 2).toISOString(), // 2 hours SLA
        priority: 'high',
        status: 'pending',
        created_at: now,
        updated_at: now,
      });

      // In-app notification for assigned agent (no financial data)
      db.notifications.create({
        organization_id: orgId,
        user_id: assignedAgent.id,
        title: 'New Lead Assigned',
        message: `${contact.full_name} has been assigned to you for ${matchedCourse?.code || 'Building & Construction'}.`,
        link: `/contacts/${contact.id}`,
        type: 'lead_assigned',
      });
    }

    // =========================================================================
    // Durable Job Queue: Auto-Acknowledgement Email
    // =========================================================================
    const isSuppressed = db.suppressions.isSuppressed(orgId, contact.email, contact.phone_raw);

    // Rule: Do NOT send real customer emails if test lead or suppressed or disabled
    if (org.auto_acknowledge_leads && !payload.isTest && !isSuppressed && contact.email) {
      db.jobQueue.enqueue({
        organization_id: orgId,
        job_type: 'send_email',
        payload: {
          type: 'lead_acknowledgement',
          contactId: contact.id,
          recipientEmail: contact.email,
          templateSlug: 'welcome-acknowledgement',
          agentName: assignedAgent ? assignedAgent.full_name : 'Admissions Advisor',
          courseTitle: matchedCourse?.title || 'Building & Construction Qualification',
          courseCode: matchedCourse?.code || 'Building & Construction',
        },
        max_attempts: 5,
        next_run_at: now,
      });
    }

    // =========================================================================
    // Audit Event Logging
    // =========================================================================
    db.auditEvents.create({
      organization_id: orgId,
      actor_name: 'Lead Ingestion System',
      action: isNewContact ? 'lead_created' : 'repeat_enquiry_recorded',
      target_type: 'contact',
      target_id: contact.id,
      details: {
        channel: payload.captureChannel,
        provider: payload.provider,
        assigned_agent: assignedAgent ? assignedAgent.full_name : 'Unassigned',
        course_code: matchedCourse?.code,
        course_review_required: courseReviewRequired,
        idempotency_key: idempotencyKey,
        is_test: !!payload.isTest,
      },
    });

    return {
      status: statusResult,
      contact,
      submission,
      assignedAgent,
      matchedCourse,
      message: isNewContact 
        ? `New contact created and assigned to ${assignedAgent?.full_name || 'Unassigned queue'}.`
        : `Enquiry linked to existing contact ${contact.full_name}. Agent preserved: ${assignedAgent?.full_name || 'None'}.`,
    };
  }
}
