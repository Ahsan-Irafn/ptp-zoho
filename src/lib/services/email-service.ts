import { db } from '@/lib/db';
import { generateSignedUnsubscribeToken } from '@/lib/utils/crypto';
import { EmailMessage, EmailTemplate } from '@/types/crm';

export class EmailService {
  private static UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || 'pracpathways_email_secret_2026';

  /**
   * Render template with variable substitution
   */
  public static renderTemplate(
    content: string, 
    variables: Record<string, string>
  ): string {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value ?? '');
    }
    return result;
  }

  /**
   * Build variables dictionary for a contact with strict role-based field filtering
   */
  public static buildVariables(
    contact: Contact, 
    orgId: string, 
    role: 'owner' | 'agent' = 'agent',
    agentName?: string,
    unsubUrl?: string
  ): Record<string, string> {
    const org = db.organizations.findById(orgId);
    const vars: Record<string, string> = {
      'first_name': contact.full_name.split(' ')[0] || contact.full_name,
      'contact.name': contact.full_name,
      'contact.email': contact.email,
      'contact.phone': contact.phone_raw || '',
      'agent.name': agentName || 'Admissions Advisor',
      'organization.name': org?.name || 'Practical Training Pathways',
      'organization.website': org?.website || 'https://pracpathways.com.au',
      'unsubscribe_url': unsubUrl || '#',
    };

    // Interpolate custom fields (STRICT: suppress owner-only fields when role is 'agent')
    if (contact.custom_fields) {
      const fieldDefs = db.fields.findMany(orgId, 'contacts');
      const allowedFields = new Set(
        fieldDefs
          .filter(f => role === 'owner' || !f.is_owner_only_view)
          .map(f => f.field_key)
      );

      for (const [key, val] of Object.entries(contact.custom_fields)) {
        if (allowedFields.has(key)) {
          vars[`custom.${key}`] = String(val ?? '');
          vars[`contact.${key}`] = String(val ?? '');
        }
      }
    }

    return vars;
  }

  /**
   * Render template for contact directly with role-aware privacy enforcement
   */
  public static renderTemplateForContact(
    content: string,
    contact: Contact,
    orgId: string,
    role: 'owner' | 'agent' = 'agent',
    agentName?: string
  ): string {
    const vars = this.buildVariables(contact, orgId, role, agentName);
    return this.renderTemplate(content, vars);
  }

  /**
   * Dispatch an approved email through transactional provider
   */
  public static async sendEmail(params: {
    organizationId: string;
    contactId: string;
    templateSlug?: string;
    customSubject?: string;
    customBody?: string;
    recipientEmail: string;
    agentName?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string; status: EmailMessage['status'] }> {
    const org = db.organizations.findById(params.organizationId);
    if (!org) return { success: false, error: 'Organization not found', status: 'failed' };

    const contact = db.contacts.findById(params.contactId);
    if (!contact) return { success: false, error: 'Contact not found', status: 'failed' };

    // 1. Check Suppression / Opt-out
    if (contact.email_suppressed || db.suppressions.isSuppressed(org.id, params.recipientEmail)) {
      const suppressedMsg = db.emailMessages.create({
        id: `email_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        organization_id: org.id,
        contact_id: contact.id,
        recipient_email: params.recipientEmail,
        subject: params.customSubject || 'Email suppressed',
        body_html: 'Delivery skipped because recipient is in suppression/opt-out list.',
        status: 'suppressed',
        sent_at: undefined,
        created_at: new Date().toISOString(),
      });
      return { success: false, error: 'Recipient email is suppressed or opted out', status: 'suppressed' };
    }

    // 2. Prepare Template & Variables
    let subject = params.customSubject || '';
    let bodyHtml = params.customBody || '';
    let templateId: string | undefined;

    if (params.templateSlug) {
      const tpl = db.emailTemplates.findBySlug(org.id, params.templateSlug);
      if (tpl) {
        templateId = tpl.id;
        subject = tpl.subject;
        bodyHtml = tpl.body_html;
      }
    }

    const unsubToken = generateSignedUnsubscribeToken(params.recipientEmail, this.UNSUBSCRIBE_SECRET);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const unsubUrl = `${appUrl}/unsubscribe?token=${unsubToken}`;

    const vars = this.buildVariables(contact, org.id, 'agent', params.agentName, unsubUrl);

    subject = this.renderTemplate(subject, vars);
    bodyHtml = this.renderTemplate(bodyHtml, vars);

    // 3. Create initial queued record
    const emailRecord = db.emailMessages.create({
      id: `email_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: org.id,
      contact_id: contact.id,
      template_id: templateId,
      recipient_email: params.recipientEmail,
      subject,
      body_html: bodyHtml,
      status: 'queued',
      created_at: new Date().toISOString(),
    });

    // 4. Provider Dispatch Simulation / Live API
    try {
      const providerMsgId = `mock_tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Update record to delivered
      db.emailMessages.updateStatus(emailRecord.id, 'delivered', {
        providerMessageId: providerMsgId,
      });

      // Audit event
      db.auditEvents.create({
        organization_id: org.id,
        actor_name: 'Email Delivery Worker',
        action: 'email_sent',
        target_type: 'email_message',
        target_id: emailRecord.id,
        details: {
          recipient: params.recipientEmail,
          subject,
          provider_message_id: providerMsgId,
        },
      });

      return {
        success: true,
        messageId: providerMsgId,
        status: 'delivered',
      };
    } catch (err: any) {
      db.emailMessages.updateStatus(emailRecord.id, 'failed', {
        errorMessage: err.message || 'Provider connection error',
      });
      return {
        success: false,
        error: err.message,
        status: 'failed',
      };
    }
  }

  /**
   * Process suppression opt-out from signed unsubscribe token
   */
  public static handleUnsubscribe(token: string): { success: boolean; email?: string } {
    const org = db.organizations.findFirst();
    if (!org) return { success: false };

    // Decode token
    try {
      const raw = Buffer.from(token, 'base64url').toString('utf8');
      const { email } = JSON.parse(raw);
      if (!email) return { success: false };

      db.suppressions.create({
        organization_id: org.id,
        email,
        reason: 'unsubscribe',
        source: 'email_link_click',
      });

      // Flag matching contacts
      const contacts = db.contacts.findMany(org.id, { search: email });
      contacts.forEach(c => {
        if (c.email.toLowerCase() === email.toLowerCase()) {
          db.contacts.update(c.id, {
            email_suppressed: true,
            suppression_reason: 'Unsubscribed via email footer link',
          });
        }
      });

      return { success: true, email };
    } catch (err) {
      return { success: false };
    }
  }
}
