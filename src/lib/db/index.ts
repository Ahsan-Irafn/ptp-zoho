import { fileDb } from './file-db';
import {
  Organization,
  Profile,
  Invitation,
  Contact,
  LeadSubmission,
  Deal,
  Task,
  CallLog,
  Note,
  EmailTemplate,
  EmailMessage,
  JobQueueItem,
  AuditEvent,
  Notification,
  IntegrationConnection,
  WebhookEvent,
  SuppressionRecord,
  Course,
  UserCredential,
  SessionRecord,
  Role,
  ModuleDefinition,
  FieldDefinition,
  CustomRecord,
} from '@/types/crm';
import { normalizeEmail, normalizePhone } from '@/lib/utils/normalization';

export const db = {
  // Organizations
  organizations: {
    findFirst: (): Organization | undefined => {
      return fileDb.read().organizations[0];
    },
    findById: (id: string): Organization | undefined => {
      return fileDb.read().organizations.find(o => o.id === id);
    },
    update: (id: string, updates: Partial<Organization>): Organization | undefined => {
      return fileDb.mutate(data => {
        const org = data.organizations.find(o => o.id === id);
        if (!org) return undefined;
        Object.assign(org, updates, { updated_at: new Date().toISOString() });
        return org;
      });
    },
    getNextRoundRobinAgent: (orgId: string): Profile | null => {
      return fileDb.mutate(data => {
        const org = data.organizations.find(o => o.id === orgId);
        if (!org) return null;

        // Fetch all active agents in deterministic order (Ayesha Sohail -> Maryam Touqeer)
        const agents = data.profiles
          .filter(p => p.organization_id === orgId && p.role === 'agent' && p.is_active)
          .sort((a, b) => a.email.localeCompare(b.email));

        if (agents.length === 0) return null;

        const index = org.round_robin_index % agents.length;
        const selectedAgent = agents[index];

        // Increment index atomically and persist across restarts
        org.round_robin_index = org.round_robin_index + 1;
        org.updated_at = new Date().toISOString();

        return selectedAgent;
      });
    }
  },

  // Profiles (Users)
  profiles: {
    findMany: (orgId: string): Profile[] => {
      return fileDb.read().profiles.filter(p => p.organization_id === orgId);
    },
    findById: (id: string): Profile | undefined => {
      return fileDb.read().profiles.find(p => p.id === id);
    },
    findByEmail: (email: string): Profile | undefined => {
      const normalized = normalizeEmail(email);
      return fileDb.read().profiles.find(p => normalizeEmail(p.email) === normalized);
    },
    create: (profile: Profile): Profile => {
      return fileDb.mutate(data => {
        data.profiles.push(profile);
        return profile;
      });
    },
    update: (id: string, updates: Partial<Profile>): Profile | undefined => {
      return fileDb.mutate(data => {
        const profile = data.profiles.find(p => p.id === id);
        if (!profile) return undefined;

        // Invariant: Prevent disabling or removing the last active owner
        if (profile.role === 'owner' && (updates.role === 'agent' || updates.is_active === false)) {
          const otherOwners = data.profiles.filter(
            p => p.organization_id === profile.organization_id && p.role === 'owner' && p.is_active && p.id !== id
          );
          if (otherOwners.length === 0) {
            throw new Error('Cannot disable or change role of the last active owner.');
          }
        }

        Object.assign(profile, updates, { updated_at: new Date().toISOString() });
        return profile;
      });
    }
  },

  // Users (Alias to Profiles)
  users: {
    findMany: (orgId: string): Profile[] => fileDb.read().profiles.filter(p => p.organization_id === orgId),
    findById: (id: string): Profile | undefined => fileDb.read().profiles.find(p => p.id === id),
    findByEmail: (email: string): Profile | undefined => {
      const normalized = normalizeEmail(email);
      return fileDb.read().profiles.find(p => normalizeEmail(p.email) === normalized);
    },
  },

  // Invitations
  invitations: {
    findMany: (orgId: string): Invitation[] => {
      return fileDb.read().invitations.filter(i => i.organization_id === orgId);
    },
    findByToken: (token: string): Invitation | undefined => {
      return fileDb.read().invitations.find(i => i.token === token);
    },
    create: (invitation: Invitation): Invitation => {
      return fileDb.mutate(data => {
        data.invitations.push(invitation);
        return invitation;
      });
    },
    markAccepted: (token: string): Invitation | undefined => {
      return fileDb.mutate(data => {
        const invite = data.invitations.find(i => i.token === token);
        if (!invite) return undefined;
        invite.accepted_at = new Date().toISOString();
        return invite;
      });
    }
  },

  // Contacts
  contacts: {
    findMany: (
      orgId: string, 
      options?: { 
        agentId?: string; // If provided (calling agent mode), filter to assigned
        agentFilter?: string; // 'all' | 'unassigned' | specific agent id
        lifecycle?: string;
        isArchived?: boolean;
        search?: string;
        doNotCall?: boolean;
      }
    ): Contact[] => {
      let list = fileDb.read().contacts.filter(c => c.organization_id === orgId);

      // Calling agent boundary filter
      if (options?.agentId) {
        list = list.filter(c => c.assigned_agent_id === options.agentId);
      }

      // Owner agent filter (e.g. 'all', 'unassigned', or specific agent ID)
      if (options?.agentFilter && options.agentFilter !== 'all') {
        if (options.agentFilter === 'unassigned') {
          list = list.filter(c => !c.assigned_agent_id);
        } else {
          list = list.filter(c => c.assigned_agent_id === options.agentFilter);
        }
      }

      // Archive filter
      if (options?.isArchived !== undefined) {
        if (options.isArchived) {
          list = list.filter(c => c.is_archived || c.lifecycle_status === 'archived');
        } else {
          list = list.filter(c => !c.is_archived && c.lifecycle_status !== 'archived');
        }
      } else if (options?.lifecycle !== 'archived') {
        // Default to non-archived records
        list = list.filter(c => !c.is_archived && c.lifecycle_status !== 'archived');
      }

      if (options?.lifecycle && options.lifecycle !== 'all' && options.lifecycle !== 'archived') {
        list = list.filter(c => c.lifecycle_status === options.lifecycle);
      }

      if (options?.doNotCall !== undefined) {
        list = list.filter(c => c.do_not_call === options.doNotCall);
      }

      if (options?.search) {
        const q = options.search.toLowerCase();
        list = list.filter(c => 
          c.full_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone_raw && c.phone_raw.includes(q)) ||
          (c.phone_normalized && c.phone_normalized.includes(q)) ||
          (c.company && c.company.toLowerCase().includes(q)) ||
          (c.city && c.city.toLowerCase().includes(q)) ||
          (c.custom_fields && Object.values(c.custom_fields).some(val => 
            String(val).toLowerCase().includes(q)
          ))
        );
      }

      return list.sort((a, b) => b.latest_enquiry_at.localeCompare(a.latest_enquiry_at));
    },

    findById: (id: string, agentId?: string): Contact | undefined => {
      const contact = fileDb.read().contacts.find(c => c.id === id);
      if (!contact) return undefined;
      // Agent boundary check
      if (agentId && contact.assigned_agent_id !== agentId) {
        return undefined; // Not authorized
      }
      return contact;
    },

    findByNormalizedEmailOrPhone: (
      orgId: string, 
      emailNorm: string, 
      phoneNorm?: string
    ): { matchedBy: 'email' | 'phone' | 'both' | 'conflict' | 'none'; contact?: Contact; conflictContact?: Contact } => {
      const contacts = fileDb.read().contacts.filter(c => c.organization_id === orgId);
      
      const emailMatches = emailNorm ? contacts.filter(c => c.email_normalized === emailNorm) : [];
      const phoneMatches = phoneNorm ? contacts.filter(c => c.phone_normalized === phoneNorm) : [];

      if (emailMatches.length > 0 && phoneMatches.length > 0) {
        if (emailMatches[0].id === phoneMatches[0].id) {
          return { matchedBy: 'both', contact: emailMatches[0] };
        } else {
          // Conflict: email belongs to contact A, but phone belongs to contact B!
          return { 
            matchedBy: 'conflict', 
            contact: emailMatches[0], 
            conflictContact: phoneMatches[0] 
          };
        }
      }

      if (emailMatches.length > 0) {
        return { matchedBy: 'email', contact: emailMatches[0] };
      }

      if (phoneMatches.length > 0) {
        return { matchedBy: 'phone', contact: phoneMatches[0] };
      }

      return { matchedBy: 'none' };
    },

    create: (contact: Contact): Contact => {
      return fileDb.mutate(data => {
        data.contacts.push(contact);
        return contact;
      });
    },

    update: (id: string, updates: Partial<Contact>): Contact | undefined => {
      return fileDb.mutate(data => {
        const contact = data.contacts.find(c => c.id === id);
        if (!contact) return undefined;
        Object.assign(contact, updates, { updated_at: new Date().toISOString() });
        return contact;
      });
    },

    reassign: (id: string, newAgentId: string | null, actorId?: string, actorName?: string): Contact | undefined => {
      return fileDb.mutate(data => {
        const contact = data.contacts.find(c => c.id === id);
        if (!contact) return undefined;
        const oldAgentId = contact.assigned_agent_id;
        contact.assigned_agent_id = newAgentId || undefined;
        contact.updated_at = new Date().toISOString();

        // Update corresponding open deals
        data.deals.forEach(d => {
          if (d.contact_id === id && d.stage !== 'enrolled' && d.stage !== 'not_proceeding') {
            d.assigned_agent_id = newAgentId || undefined;
            d.updated_at = new Date().toISOString();
          }
        });

        // Update pending tasks
        data.tasks.forEach(t => {
          if (t.contact_id === id && t.status === 'pending') {
            if (newAgentId) t.assigned_agent_id = newAgentId;
            t.updated_at = new Date().toISOString();
          }
        });

        // Log audit event
        data.audit_events.push({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: contact.organization_id,
          actor_id: actorId,
          actor_name: actorName || 'System',
          action: 'contact.reassigned',
          target_type: 'contact',
          target_id: id,
          details: { old_agent_id: oldAgentId, new_agent_id: newAgentId },
          created_at: new Date().toISOString(),
        });

        return contact;
      });
    },

    archive: (id: string, actorId?: string, actorName?: string): Contact | undefined => {
      return fileDb.mutate(data => {
        const contact = data.contacts.find(c => c.id === id);
        if (!contact) return undefined;
        contact.is_archived = true;
        contact.lifecycle_status = 'archived';
        contact.updated_at = new Date().toISOString();

        data.audit_events.push({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: contact.organization_id,
          actor_id: actorId,
          actor_name: actorName || 'System',
          action: 'contact.archived',
          target_type: 'contact',
          target_id: id,
          created_at: new Date().toISOString(),
        });

        return contact;
      });
    },

    restore: (id: string, actorId?: string, actorName?: string): Contact | undefined => {
      return fileDb.mutate(data => {
        const contact = data.contacts.find(c => c.id === id);
        if (!contact) return undefined;
        contact.is_archived = false;
        contact.lifecycle_status = 'lead';
        contact.updated_at = new Date().toISOString();

        data.audit_events.push({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: contact.organization_id,
          actor_id: actorId,
          actor_name: actorName || 'System',
          action: 'contact.restored',
          target_type: 'contact',
          target_id: id,
          created_at: new Date().toISOString(),
        });

        return contact;
      });
    },

    delete: (id: string): boolean => {
      return fileDb.mutate(data => {
        const index = data.contacts.findIndex(c => c.id === id);
        if (index === -1) return false;
        data.contacts.splice(index, 1);
        return true;
      });
    },

    merge: (primaryId: string, duplicateId: string, actorId: string, actorName: string): Contact => {
      return fileDb.mutate(data => {
        const primary = data.contacts.find(c => c.id === primaryId);
        const duplicate = data.contacts.find(c => c.id === duplicateId);
        if (!primary || !duplicate) throw new Error('Primary or duplicate contact not found');

        // Re-link lead submissions
        data.lead_submissions.forEach(lead => {
          if (lead.contact_id === duplicateId) lead.contact_id = primaryId;
        });

        // Re-link call logs
        data.call_logs.forEach(call => {
          if (call.contact_id === duplicateId) call.contact_id = primaryId;
        });

        // Re-link notes
        data.notes.forEach(note => {
          if (note.contact_id === duplicateId) note.contact_id = primaryId;
        });

        // Re-link tasks
        data.tasks.forEach(task => {
          if (task.contact_id === duplicateId) task.contact_id = primaryId;
        });

        // Re-link deals
        data.deals.forEach(deal => {
          if (deal.contact_id === duplicateId) deal.contact_id = primaryId;
        });

        // Re-link emails
        data.email_messages.forEach(msg => {
          if (msg.contact_id === duplicateId) msg.contact_id = primaryId;
        });

        // Merge tags
        primary.tags = Array.from(new Set([...primary.tags, ...duplicate.tags]));
        if (!primary.company && duplicate.company) primary.company = duplicate.company;
        if (!primary.city && duplicate.city) primary.city = duplicate.city;
        if (!primary.phone_raw && duplicate.phone_raw) {
          primary.phone_raw = duplicate.phone_raw;
          primary.phone_normalized = duplicate.phone_normalized;
        }

        primary.updated_at = new Date().toISOString();

        // Remove duplicate contact
        const dupIdx = data.contacts.findIndex(c => c.id === duplicateId);
        if (dupIdx !== -1) data.contacts.splice(dupIdx, 1);

        // Record Audit Event
        data.audit_events.push({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: primary.organization_id,
          actor_id: actorId,
          actor_name: actorName,
          action: 'contact_merged',
          target_type: 'contact',
          target_id: primaryId,
          details: {
            merged_contact_id: duplicateId,
            merged_contact_email: duplicate.email,
            merged_contact_name: duplicate.full_name,
          },
          created_at: new Date().toISOString(),
        });

        return primary;
      });
    }
  },

  // Lead Submissions (Enquiries)
  leads: {
    findMany: (orgId: string, contactId?: string): LeadSubmission[] => {
      let list = fileDb.read().lead_submissions.filter(l => l.organization_id === orgId);
      if (contactId) {
        list = list.filter(l => l.contact_id === contactId);
      }
      return list.sort((a, b) => b.submission_timestamp.localeCompare(a.submission_timestamp));
    },

    findById: (id: string): LeadSubmission | undefined => {
      return fileDb.read().lead_submissions.find(l => l.id === id);
    },

    findByIdempotencyKey: (orgId: string, idempotencyKey: string): LeadSubmission | undefined => {
      return fileDb.read().lead_submissions.find(
        l => l.organization_id === orgId && l.idempotency_key === idempotencyKey
      );
    },

    create: (lead: LeadSubmission): LeadSubmission => {
      return fileDb.mutate(data => {
        // Enforce idempotency
        const existing = data.lead_submissions.find(
          l => l.organization_id === lead.organization_id && l.idempotency_key === lead.idempotency_key
        );
        if (existing) {
          return existing;
        }
        data.lead_submissions.push(lead);
        return lead;
      });
    }
  },

  // Deals / Course Enquiry Pipeline
  deals: {
    findMany: (orgId: string, filter?: string | { agentId?: string; role?: Role }): Deal[] => {
      let agentId: string | undefined;
      let role: Role | undefined;
      if (typeof filter === 'string') {
        agentId = filter;
      } else if (filter) {
        agentId = filter.agentId;
        role = filter.role;
      }

      let list = fileDb.read().deals.filter(d => d.organization_id === orgId);
      if (agentId) {
        list = list.filter(d => d.assigned_agent_id === agentId);
      }
      const sorted = list.sort((a, b) => b.created_at.localeCompare(a.created_at));

      // Data Access Layer Protection: Strip financial fields for calling agents
      if (role === 'agent' || (agentId && role !== 'owner')) {
        return sorted.map(d => {
          const clone = { ...d };
          delete clone.value;
          delete clone.currency;
          return clone;
        });
      }

      return sorted;
    },
    findByContactId: (contactId: string, role?: Role): Deal[] => {
      const deals = fileDb.read().deals.filter(d => d.contact_id === contactId);
      if (role === 'agent') {
        return deals.map(d => {
          const clone = { ...d };
          delete clone.value;
          delete clone.currency;
          return clone;
        });
      }
      return deals;
    },
    findById: (id: string, filter?: string | { agentId?: string; role?: Role }): Deal | undefined => {
      let agentId: string | undefined;
      let role: Role | undefined;
      if (typeof filter === 'string') {
        agentId = filter;
      } else if (filter) {
        agentId = filter.agentId;
        role = filter.role;
      }

      const deal = fileDb.read().deals.find(d => d.id === id);
      if (!deal) return undefined;
      if (agentId && deal.assigned_agent_id !== agentId) return undefined;

      // Data Access Layer Protection: Strip financial fields for calling agents
      if (role === 'agent' || (agentId && role !== 'owner')) {
        const clone = { ...deal };
        delete clone.value;
        delete clone.currency;
        return clone;
      }

      return deal;
    },
    create: (deal: Deal): Deal => {
      return fileDb.mutate(data => {
        data.deals.push(deal);
        return deal;
      });
    },
    update: (id: string, updates: Partial<Deal>): Deal | undefined => {
      return fileDb.mutate(data => {
        const deal = data.deals.find(d => d.id === id);
        if (!deal) return undefined;
        Object.assign(deal, updates, { updated_at: new Date().toISOString() });
        return deal;
      });
    }
  },

  // Tasks
  tasks: {
    findMany: (orgId: string, agentId?: string): Task[] => {
      let list = fileDb.read().tasks.filter(t => t.organization_id === orgId);
      if (agentId) {
        list = list.filter(t => t.assigned_agent_id === agentId);
      }
      return list.sort((a, b) => a.due_date.localeCompare(b.due_date));
    },
    findByContactId: (contactId: string): Task[] => {
      return fileDb.read().tasks.filter(t => t.contact_id === contactId);
    },
    findById: (id: string, agentId?: string): Task | undefined => {
      const task = fileDb.read().tasks.find(t => t.id === id);
      if (!task) return undefined;
      if (agentId && task.assigned_agent_id !== agentId) return undefined;
      return task;
    },
    create: (task: Task): Task => {
      return fileDb.mutate(data => {
        data.tasks.push(task);
        return task;
      });
    },
    update: (id: string, updates: Partial<Task>): Task | undefined => {
      return fileDb.mutate(data => {
        const task = data.tasks.find(t => t.id === id);
        if (!task) return undefined;
        Object.assign(task, updates, { updated_at: new Date().toISOString() });
        return task;
      });
    }
  },

  // Call Logs
  callLogs: {
    findMany: (orgId: string, agentId?: string): CallLog[] => {
      let list = fileDb.read().call_logs.filter(c => c.organization_id === orgId);
      if (agentId) {
        list = list.filter(c => c.agent_id === agentId);
      }
      return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    },
    findByContactId: (contactId: string): CallLog[] => {
      return fileDb.read().call_logs
        .filter(c => c.contact_id === contactId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    },
    findByProviderCallId: (orgId: string, providerCallId: string): CallLog | undefined => {
      return fileDb.read().call_logs.find(
        c => c.organization_id === orgId && c.provider_call_id === providerCallId
      );
    },
    create: (callLog: CallLog): CallLog => {
      return fileDb.mutate(data => {
        data.call_logs.push(callLog);
        
        // Update contact last contacted date and next follow up if given
        const contact = data.contacts.find(c => c.id === callLog.contact_id);
        if (contact) {
          contact.last_contacted_at = callLog.timestamp;
          if (callLog.follow_up_date) {
            contact.next_follow_up_at = callLog.follow_up_date;
          }
          if (callLog.outcome === 'do_not_call') {
            contact.do_not_call = true;
          }
          contact.updated_at = new Date().toISOString();
        }

        return callLog;
      });
    },
    update: (id: string, updates: Partial<CallLog>): CallLog | undefined => {
      return fileDb.mutate(data => {
        const log = data.call_logs.find(c => c.id === id);
        if (!log) return undefined;
        Object.assign(log, updates);
        return log;
      });
    }
  },

  // Notes
  notes: {
    findByContactId: (contactId: string): Note[] => {
      return fileDb.read().notes
        .filter(n => n.contact_id === contactId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    create: (note: Note): Note => {
      return fileDb.mutate(data => {
        data.notes.push(note);
        return note;
      });
    }
  },

  // Email Templates
  emailTemplates: {
    findMany: (orgId: string): EmailTemplate[] => {
      return fileDb.read().email_templates.filter(t => t.organization_id === orgId);
    },
    findBySlug: (orgId: string, slug: string): EmailTemplate | undefined => {
      return fileDb.read().email_templates.find(t => t.organization_id === orgId && t.slug === slug);
    },
    create: (template: EmailTemplate): EmailTemplate => {
      return fileDb.mutate(data => {
        data.email_templates.push(template);
        return template;
      });
    },
    update: (id: string, updates: Partial<EmailTemplate>): EmailTemplate | undefined => {
      return fileDb.mutate(data => {
        const template = data.email_templates.find(t => t.id === id);
        if (!template) return undefined;
        Object.assign(template, updates, { updated_at: new Date().toISOString() });
        return template;
      });
    }
  },

  // Email Messages
  emailMessages: {
    findMany: (orgId: string, contactId?: string): EmailMessage[] => {
      let list = fileDb.read().email_messages.filter(m => m.organization_id === orgId);
      if (contactId) {
        list = list.filter(m => m.contact_id === contactId);
      }
      return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    create: (message: EmailMessage): EmailMessage => {
      return fileDb.mutate(data => {
        data.email_messages.push(message);
        return message;
      });
    },
    updateStatus: (
      id: string, 
      status: EmailMessage['status'], 
      extra?: { providerMessageId?: string; errorMessage?: string }
    ): EmailMessage | undefined => {
      return fileDb.mutate(data => {
        const msg = data.email_messages.find(m => m.id === id);
        if (!msg) return undefined;
        msg.status = status;
        if (status === 'delivered' || status === 'submitted') {
          msg.sent_at = new Date().toISOString();
        }
        if (extra?.providerMessageId) msg.provider_message_id = extra.providerMessageId;
        if (extra?.errorMessage) msg.error_message = extra.errorMessage;
        return msg;
      });
    }
  },

  // Job Queue (Durable background queue with atomic lock)
  jobQueue: {
    enqueue: (job: any): JobQueueItem => {
      return fileDb.mutate(data => {
        const item: JobQueueItem = {
          id: `job_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: job.organization_id || job.organizationId,
          job_type: job.job_type,
          payload: job.payload || {},
          max_attempts: job.max_attempts || 5,
          next_run_at: job.next_run_at || new Date().toISOString(),
          status: 'pending',
          attempts: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        data.job_queue.push(item);
        return item;
      });
    },

    pollAndLockJobs: (workerId: string, limit: number = 10): JobQueueItem[] => {
      return fileDb.mutate(data => {
        const now = new Date().toISOString();
        const pending = data.job_queue
          .filter(j => (j.status === 'pending' || (j.status === 'processing' && j.locked_at && new Date(j.locked_at).getTime() < Date.now() - 300000)) && j.next_run_at <= now)
          .slice(0, limit);

        pending.forEach(job => {
          job.status = 'processing';
          job.locked_at = now;
          job.locked_by = workerId;
          job.attempts += 1;
          job.updated_at = now;
        });

        return pending;
      });
    },

    markComplete: (jobId: string): void => {
      fileDb.mutate(data => {
        const job = data.job_queue.find(j => j.id === jobId);
        if (job) {
          job.status = 'completed';
          job.updated_at = new Date().toISOString();
        }
      });
    },

    markFailed: (jobId: string, error: string): void => {
      fileDb.mutate(data => {
        const job = data.job_queue.find(j => j.id === jobId);
        if (!job) return;

        if (job.status !== 'processing') {
          job.attempts += 1;
        }
        job.last_error = error;
        job.updated_at = new Date().toISOString();

        if (job.attempts >= job.max_attempts) {
          job.status = 'dead_letter';
        } else {
          job.status = 'pending';
          // Exponential backoff: 2^(attempts) * 30 seconds
          const delaySec = Math.pow(2, job.attempts) * 30;
          job.next_run_at = new Date(Date.now() + delaySec * 1000).toISOString();
        }
      });
    },

    findMany: (orgId: string): JobQueueItem[] => {
      return fileDb.read().job_queue
        .filter(j => j.organization_id === orgId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  },

  // Audit Events
  auditEvents: {
    findMany: (orgId: string): AuditEvent[] => {
      return fileDb.read().audit_events
        .filter(a => a.organization_id === orgId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    create: (event: Omit<AuditEvent, 'id' | 'created_at'>): AuditEvent => {
      return fileDb.mutate(data => {
        const item: AuditEvent = {
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          created_at: new Date().toISOString(),
          ...event,
        };
        data.audit_events.push(item);
        return item;
      });
    }
  },

  // Notifications
  notifications: {
    findMany: (userId: string): Notification[] => {
      return fileDb.read().notifications
        .filter(n => n.user_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    create: (notif: Omit<Notification, 'id' | 'created_at' | 'is_read'>): Notification => {
      return fileDb.mutate(data => {
        const item: Notification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          is_read: false,
          created_at: new Date().toISOString(),
          ...notif,
        };
        data.notifications.push(item);
        return item;
      });
    },
    markRead: (id: string): void => {
      fileDb.mutate(data => {
        const notif = data.notifications.find(n => n.id === id);
        if (notif) notif.is_read = true;
      });
    }
  },

  // Integrations
  integrations: {
    findMany: (orgId: string): IntegrationConnection[] => {
      return fileDb.read().integration_connections.filter(i => i.organization_id === orgId);
    },
    findByProvider: (orgId: string, provider: IntegrationConnection['provider']): IntegrationConnection | undefined => {
      return fileDb.read().integration_connections.find(i => i.organization_id === orgId && i.provider === provider);
    },
    upsert: (
      orgId: string, 
      provider: IntegrationConnection['provider'], 
      updates: Partial<IntegrationConnection>
    ): IntegrationConnection => {
      return fileDb.mutate(data => {
        let conn = data.integration_connections.find(i => i.organization_id === orgId && i.provider === provider);
        const now = new Date().toISOString();
        if (conn) {
          Object.assign(conn, updates, { updated_at: now });
        } else {
          conn = {
            id: `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            organization_id: orgId,
            provider,
            status: 'not_connected',
            credentials_encrypted: {},
            config: {},
            updated_at: now,
            ...updates,
          };
          data.integration_connections.push(conn);
        }
        return conn;
      });
    }
  },

  // Webhook Events
  webhookEvents: {
    findByIdempotencyKey: (orgId: string, provider: string, key: string): WebhookEvent | undefined => {
      return fileDb.read().webhook_events.find(
        w => w.organization_id === orgId && w.provider === provider && w.idempotency_key === key
      );
    },
    create: (event: Omit<WebhookEvent, 'id' | 'created_at'>): WebhookEvent => {
      return fileDb.mutate(data => {
        const item: WebhookEvent = {
          id: `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          created_at: new Date().toISOString(),
          ...event,
        };
        data.webhook_events.push(item);
        return item;
      });
    },
    updateStatus: (orgId: string, provider: string, key: string, status: WebhookEvent['status'], errorMsg?: string): WebhookEvent | undefined => {
      return fileDb.mutate(data => {
        const item = data.webhook_events.find(
          w => w.organization_id === orgId && w.provider === provider && w.idempotency_key === key
        );
        if (item) {
          item.status = status;
          if (errorMsg) item.error_message = errorMsg;
        }
        return item;
      });
    }
  },

  // Suppressions
  suppressions: {
    findMany: (orgId: string): SuppressionRecord[] => {
      return fileDb.read().suppression_records.filter(s => s.organization_id === orgId);
    },
    isSuppressed: (orgId: string, email?: string, phone?: string): boolean => {
      const records = fileDb.read().suppression_records.filter(s => s.organization_id === orgId);
      if (email) {
        const normEmail = normalizeEmail(email);
        if (records.some(r => r.email && normalizeEmail(r.email) === normEmail)) return true;
      }
      if (phone) {
        const normPhone = normalizePhone(phone);
        if (records.some(r => r.phone && normalizePhone(r.phone) === normPhone)) return true;
      }
      return false;
    },
    create: (record: Omit<SuppressionRecord, 'id' | 'created_at'>): SuppressionRecord => {
      return fileDb.mutate(data => {
        const item: SuppressionRecord = {
          id: `suppress_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          created_at: new Date().toISOString(),
          ...record,
        };
        data.suppression_records.push(item);
        return item;
      });
    }
  },

  // Courses Catalogue
  courses: {
    findAll: (): Course[] => {
      return fileDb.read().courses;
    },
    findMany: (orgId: string, onlyActive: boolean = true): Course[] => {
      let list = fileDb.read().courses.filter(c => c.organization_id === orgId);
      if (onlyActive) {
        list = list.filter(c => c.is_active);
      }
      return list.sort((a, b) => a.code.localeCompare(b.code));
    },
    findById: (id: string): Course | undefined => {
      return fileDb.read().courses.find(c => c.id === id);
    },
    findByCode: (orgId: string, code: string): Course | undefined => {
      const clean = code.trim().toUpperCase();
      return fileDb.read().courses.find(c => c.organization_id === orgId && c.code.toUpperCase() === clean);
    },
    create: (course: Course): Course => {
      return fileDb.mutate(data => {
        data.courses.push(course);
        return course;
      });
    },
    update: (id: string, updates: Partial<Course>): Course | undefined => {
      return fileDb.mutate(data => {
        const course = data.courses.find(c => c.id === id);
        if (!course) return undefined;
        Object.assign(course, updates, { updated_at: new Date().toISOString() });
        return course;
      });
    }
  },

  // User Credentials (PBKDF2 Password Authentication)
  credentials: {
    findByEmail: (email: string): UserCredential | undefined => {
      const normalized = normalizeEmail(email);
      return fileDb.read().user_credentials.find(c => normalizeEmail(c.email) === normalized);
    },
    set: (cred: UserCredential): void => {
      fileDb.mutate(data => {
        const idx = data.user_credentials.findIndex(c => normalizeEmail(c.email) === normalizeEmail(cred.email));
        if (idx !== -1) {
          data.user_credentials[idx] = cred;
        } else {
          data.user_credentials.push(cred);
        }
      });
    }
  },

  // Authenticated Sessions & Revocation
  sessions: {
    create: (session: SessionRecord): SessionRecord => {
      return fileDb.mutate(data => {
        data.sessions.push(session);
        return session;
      });
    },
    findByToken: (token: string): SessionRecord | undefined => {
      const session = fileDb.read().sessions.find(s => s.token === token);
      if (!session) return undefined;
      if (new Date(session.expires_at).getTime() < Date.now()) {
        return undefined; // Expired session
      }
      return session;
    },
    revoke: (token: string): void => {
      fileDb.mutate(data => {
        const idx = data.sessions.findIndex(s => s.token === token);
        if (idx !== -1) data.sessions.splice(idx, 1);
      });
    },
    revokeAllForUser: (userId: string): void => {
      fileDb.mutate(data => {
        data.sessions = data.sessions.filter(s => s.user_id !== userId);
      });
    }
  },

  // Module Definitions (Owner-Only Builder)
  modules: {
    findMany: (orgId: string, options?: { includeDisabled?: boolean; role?: Role }): ModuleDefinition[] => {
      let list = fileDb.read().module_definitions.filter(m => m.organization_id === orgId);
      if (!options?.includeDisabled) {
        list = list.filter(m => m.is_enabled);
      }
      if (options?.role === 'agent') {
        list = list.filter(m => m.agent_access !== 'none');
      }
      return list.sort((a, b) => (a.sidebar_position ?? 99) - (b.sidebar_position ?? 99));
    },

    findByKey: (orgId: string, key: string): ModuleDefinition | undefined => {
      return fileDb.read().module_definitions.find(m => m.organization_id === orgId && m.key === key);
    },

    create: (moduleDef: ModuleDefinition): ModuleDefinition => {
      return fileDb.mutate(data => {
        // Enforce valid slug key
        const cleanKey = moduleDef.key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const existing = data.module_definitions.find(m => m.organization_id === moduleDef.organization_id && m.key === cleanKey);
        if (existing) {
          throw new Error(`Module with key '${cleanKey}' already exists.`);
        }

        const newModule: ModuleDefinition = {
          ...moduleDef,
          is_system: !!moduleDef.is_system,
          key: cleanKey,
          id: moduleDef.id || `mod_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        data.module_definitions.push(newModule);

        // Audit Event
        data.audit_events.push({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: moduleDef.organization_id,
          actor_name: 'Owner',
          action: 'module.created',
          target_type: 'module',
          target_id: newModule.id,
          details: { key: newModule.key, name: newModule.name },
          created_at: new Date().toISOString(),
        });

        return newModule;
      });
    },

    update: (orgId: string, key: string, updates: Partial<ModuleDefinition>): ModuleDefinition | undefined => {
      return fileDb.mutate(data => {
        const mod = data.module_definitions.find(m => m.organization_id === orgId && m.key === key);
        if (!mod) return undefined;

        // Invariant: System modules cannot have their key changed or be deleted
        if (mod.is_system && updates.key && updates.key !== mod.key) {
          throw new Error('Cannot change internal key of protected system module.');
        }

        Object.assign(mod, updates, { updated_at: new Date().toISOString() });

        data.audit_events.push({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: orgId,
          actor_name: 'Owner',
          action: 'module.updated',
          target_type: 'module',
          target_id: mod.id,
          details: { key: mod.key, updates },
          created_at: new Date().toISOString(),
        });

        return mod;
      });
    },

    archive: (orgId: string, key: string): boolean => {
      return fileDb.mutate(data => {
        const mod = data.module_definitions.find(m => m.organization_id === orgId && m.key === key);
        if (!mod) return false;
        if (mod.is_system) {
          throw new Error('Protected system modules cannot be disabled or archived.');
        }
        mod.is_enabled = false;
        mod.updated_at = new Date().toISOString();

        data.audit_events.push({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: orgId,
          actor_name: 'Owner',
          action: 'module.archived',
          target_type: 'module',
          target_id: mod.id,
          details: { key: mod.key },
          created_at: new Date().toISOString(),
        });

        return true;
      });
    }
  },

  // Field Definitions (Owner-Only Builder)
  fields: {
    findMany: (
      orgId: string, 
      moduleKey?: string, 
      options?: { includeArchived?: boolean; role?: Role }
    ): FieldDefinition[] => {
      let list = fileDb.read().field_definitions.filter(f => f.organization_id === orgId);
      if (moduleKey) {
        list = list.filter(f => f.module_key === moduleKey);
      }
      if (!options?.includeArchived) {
        list = list.filter(f => !f.is_archived);
      }
      if (options?.role === 'agent') {
        list = list.filter(f => !f.is_owner_only_view);
      }
      return list.sort((a, b) => a.display_order - b.display_order);
    },

    findById: (id: string): FieldDefinition | undefined => {
      return fileDb.read().field_definitions.find(f => f.id === id);
    },

    findByKey: (orgId: string, moduleKey: string, fieldKey: string): FieldDefinition | undefined => {
      return fileDb.read().field_definitions.find(
        f => f.organization_id === orgId && f.module_key === moduleKey && f.field_key === fieldKey
      );
    },

    create: (fieldDef: FieldDefinition): FieldDefinition => {
      return fileDb.mutate(data => {
        const cleanKey = fieldDef.field_key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const existing = data.field_definitions.find(
          f => f.organization_id === fieldDef.organization_id && f.module_key === fieldDef.module_key && f.field_key === cleanKey
        );
        if (existing) {
          throw new Error(`Field '${cleanKey}' already exists in module '${fieldDef.module_key}'.`);
        }

        const newField: FieldDefinition = {
          ...fieldDef,
          field_key: cleanKey,
          id: fieldDef.id || `fld_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        data.field_definitions.push(newField);

        data.audit_events.push({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: fieldDef.organization_id,
          actor_name: 'Owner',
          action: 'field.created',
          target_type: 'field',
          target_id: newField.id,
          details: { module_key: newField.module_key, field_key: newField.field_key, label: newField.label, type: newField.field_type },
          created_at: new Date().toISOString(),
        });

        return newField;
      });
    },

    update: (orgId: string, id: string, updates: Partial<FieldDefinition>): FieldDefinition | undefined => {
      return fileDb.mutate(data => {
        const field = data.field_definitions.find(f => f.id === id && f.organization_id === orgId);
        if (!field) return undefined;

        // Invariant: field_key cannot be changed once created to preserve stored values & integrations
        if (updates.field_key && updates.field_key !== field.field_key) {
          throw new Error('Stable internal field key cannot be modified. Edit display label instead.');
        }

        if (field.is_system && updates.field_type && updates.field_type !== field.field_type) {
          throw new Error('Cannot change type of protected system field.');
        }

        Object.assign(field, updates, { updated_at: new Date().toISOString() });

        data.audit_events.push({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: orgId,
          actor_name: 'Owner',
          action: 'field.updated',
          target_type: 'field',
          target_id: field.id,
          details: { field_key: field.field_key, updates },
          created_at: new Date().toISOString(),
        });

        return field;
      });
    },

    archive: (orgId: string, id: string): FieldDefinition | undefined => {
      return fileDb.mutate(data => {
        const field = data.field_definitions.find(f => f.id === id && f.organization_id === orgId);
        if (!field) return undefined;
        if (field.is_system) {
          throw new Error('Protected system fields cannot be archived or deleted.');
        }
        field.is_archived = true;
        field.updated_at = new Date().toISOString();

        data.audit_events.push({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: orgId,
          actor_name: 'Owner',
          action: 'field.archived',
          target_type: 'field',
          target_id: field.id,
          details: { module_key: field.module_key, field_key: field.field_key },
          created_at: new Date().toISOString(),
        });

        return field;
      });
    },

    restore: (orgId: string, id: string): FieldDefinition | undefined => {
      return fileDb.mutate(data => {
        const field = data.field_definitions.find(f => f.id === id && f.organization_id === orgId);
        if (!field) return undefined;
        field.is_archived = false;
        field.updated_at = new Date().toISOString();

        data.audit_events.push({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: orgId,
          actor_name: 'Owner',
          action: 'field.restored',
          target_type: 'field',
          target_id: field.id,
          details: { module_key: field.module_key, field_key: field.field_key },
          created_at: new Date().toISOString(),
        });

        return field;
      });
    },

    checkDependencies: (orgId: string, moduleKey: string, fieldKey: string): { recordCount: number; message: string } => {
      const dbData = fileDb.read();
      let recordCount = 0;

      if (moduleKey === 'contacts') {
        recordCount = dbData.contacts.filter(c => c.custom_fields && c.custom_fields[fieldKey] !== undefined && c.custom_fields[fieldKey] !== '').length;
      } else if (moduleKey === 'deals') {
        recordCount = dbData.deals.filter(d => d.custom_fields && d.custom_fields[fieldKey] !== undefined && d.custom_fields[fieldKey] !== '').length;
      } else if (moduleKey === 'tasks') {
        recordCount = dbData.tasks.filter(t => t.custom_fields && t.custom_fields[fieldKey] !== undefined && t.custom_fields[fieldKey] !== '').length;
      } else if (moduleKey === 'leads') {
        recordCount = dbData.lead_submissions.filter(l => l.custom_fields && l.custom_fields[fieldKey] !== undefined && l.custom_fields[fieldKey] !== '').length;
      } else if (moduleKey === 'courses') {
        recordCount = dbData.courses.filter(c => c.custom_fields && c.custom_fields[fieldKey] !== undefined && c.custom_fields[fieldKey] !== '').length;
      } else {
        recordCount = dbData.custom_records.filter(r => r.module_key === moduleKey && r.data && r.data[fieldKey] !== undefined && r.data[fieldKey] !== '').length;
      }

      return {
        recordCount,
        message: recordCount > 0 
          ? `${recordCount} record(s) currently store active data in '${fieldKey}'. Archiving this field will safely hide it from forms while preserving all historical data.`
          : `No records currently store data in '${fieldKey}'. Safe to disable or archive.`
      };
    },

    validateFieldValue: (fieldDef: FieldDefinition, value: any): { valid: boolean; error?: string } => {
      const isEmpty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
      if (fieldDef.is_required && isEmpty) {
        return { valid: false, error: `${fieldDef.label} is required.` };
      }
      if (isEmpty) return { valid: true };

      switch (fieldDef.field_type) {
        case 'email': {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(String(value))) {
            return { valid: false, error: `${fieldDef.label} must be a valid email address.` };
          }
          break;
        }
        case 'phone': {
          const phoneClean = String(value).replace(/[\s\-\(\)\+]/g, '');
          if (phoneClean.length < 8) {
            return { valid: false, error: `${fieldDef.label} must be a valid Australian or international phone number.` };
          }
          break;
        }
        case 'number': {
          const num = Number(value);
          if (isNaN(num)) {
            return { valid: false, error: `${fieldDef.label} must be a valid number.` };
          }
          if (fieldDef.validation_rules?.min !== undefined && num < fieldDef.validation_rules.min) {
            return { valid: false, error: `${fieldDef.label} must be at least ${fieldDef.validation_rules.min}.` };
          }
          if (fieldDef.validation_rules?.max !== undefined && num > fieldDef.validation_rules.max) {
            return { valid: false, error: `${fieldDef.label} cannot exceed ${fieldDef.validation_rules.max}.` };
          }
          break;
        }
        case 'date':
        case 'datetime': {
          const d = new Date(value);
          if (isNaN(d.getTime())) {
            return { valid: false, error: `${fieldDef.label} must be a valid date.` };
          }
          break;
        }
        case 'single_select': {
          if (fieldDef.options && fieldDef.options.length > 0) {
            const validValues = fieldDef.options.map(o => o.value);
            if (!validValues.includes(String(value))) {
              return { valid: false, error: `${fieldDef.label} must be one of: ${validValues.join(', ')}.` };
            }
          }
          break;
        }
        case 'multi_select': {
          if (!Array.isArray(value)) {
            return { valid: false, error: `${fieldDef.label} must be an array of selected options.` };
          }
          if (fieldDef.options && fieldDef.options.length > 0) {
            const validValues = new Set(fieldDef.options.map(o => o.value));
            for (const item of value) {
              if (!validValues.has(String(item))) {
                return { valid: false, error: `Invalid option '${item}' in ${fieldDef.label}.` };
              }
            }
          }
          break;
        }
        case 'url': {
          if (!String(value).startsWith('http://') && !String(value).startsWith('https://')) {
            return { valid: false, error: `${fieldDef.label} must start with http:// or https://.` };
          }
          break;
        }
        case 'short_text': {
          if (fieldDef.validation_rules?.max && String(value).length > fieldDef.validation_rules.max) {
            return { valid: false, error: `${fieldDef.label} exceeds maximum length of ${fieldDef.validation_rules.max} characters.` };
          }
          break;
        }
      }

      return { valid: true };
    }
  },

  // Custom Module Records (Dynamic CRUD)
  customRecords: {
    findMany: (
      orgId: string, 
      moduleKey: string, 
      options?: { agentId?: string; isArchived?: boolean; search?: string }
    ): CustomRecord[] => {
      let list = fileDb.read().custom_records.filter(r => r.organization_id === orgId && r.module_key === moduleKey);

      if (options?.agentId) {
        list = list.filter(r => r.assigned_agent_id === options.agentId);
      }

      if (options?.isArchived !== undefined) {
        list = list.filter(r => (r.is_archived ?? false) === options.isArchived);
      } else {
        list = list.filter(r => !r.is_archived);
      }

      if (options?.search) {
        const q = options.search.toLowerCase();
        list = list.filter(r => 
          r.title.toLowerCase().includes(q) ||
          (r.data && Object.values(r.data).some(v => String(v).toLowerCase().includes(q)))
        );
      }

      return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    findById: (id: string, agentId?: string): CustomRecord | undefined => {
      const rec = fileDb.read().custom_records.find(r => r.id === id);
      if (!rec) return undefined;
      if (agentId && rec.assigned_agent_id && rec.assigned_agent_id !== agentId) {
        return undefined; // Agent boundary
      }
      return rec;
    },

    create: (record: CustomRecord): CustomRecord => {
      return fileDb.mutate(data => {
        const newRecord: CustomRecord = {
          ...record,
          id: record.id || `rec_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        data.custom_records.push(newRecord);

        data.audit_events.push({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: newRecord.organization_id,
          actor_id: newRecord.created_by,
          actor_name: 'User',
          action: 'custom_record.created',
          target_type: newRecord.module_key,
          target_id: newRecord.id,
          details: { title: newRecord.title },
          created_at: new Date().toISOString(),
        });

        return newRecord;
      });
    },

    update: (id: string, updates: Partial<CustomRecord>): CustomRecord | undefined => {
      return fileDb.mutate(data => {
        const rec = data.custom_records.find(r => r.id === id);
        if (!rec) return undefined;

        if (updates.data) {
          rec.data = { ...rec.data, ...updates.data };
        }
        if (updates.title !== undefined) rec.title = updates.title;
        if (updates.assigned_agent_id !== undefined) rec.assigned_agent_id = updates.assigned_agent_id;
        if (updates.is_archived !== undefined) rec.is_archived = updates.is_archived;
        rec.updated_at = new Date().toISOString();

        data.audit_events.push({
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          organization_id: rec.organization_id,
          actor_name: 'User',
          action: 'custom_record.updated',
          target_type: rec.module_key,
          target_id: rec.id,
          details: { title: rec.title },
          created_at: new Date().toISOString(),
        });

        return rec;
      });
    },

    archive: (id: string): CustomRecord | undefined => {
      return fileDb.mutate(data => {
        const rec = data.custom_records.find(r => r.id === id);
        if (!rec) return undefined;
        rec.is_archived = true;
        rec.updated_at = new Date().toISOString();
        return rec;
      });
    },

    restore: (id: string): CustomRecord | undefined => {
      return fileDb.mutate(data => {
        const rec = data.custom_records.find(r => r.id === id);
        if (!rec) return undefined;
        rec.is_archived = false;
        rec.updated_at = new Date().toISOString();
        return rec;
      });
    }
  }
};

/**
 * Server-level sanitization: strips owner-only fields before returning payloads to calling agents.
 */
export function sanitizeRecordForRole(moduleKey: string, record: any, role: Role, fieldDefs?: FieldDefinition[]): any {
  if (!record) return record;
  if (role === 'owner') return record;

  const sanitized = { ...record };

  // Financial fields protection in deals
  if (moduleKey === 'deals') {
    delete sanitized.value;
    delete sanitized.currency;
  }

  // Sanitize custom_fields
  if (sanitized.custom_fields && typeof sanitized.custom_fields === 'object') {
    const defs = fieldDefs || fileDb.read().field_definitions.filter(
      f => f.organization_id === record.organization_id && f.module_key === moduleKey
    );
    const ownerOnlyKeys = new Set(
      defs.filter(f => f.is_owner_only_view).map(f => f.field_key)
    );

    const cleanCustomFields: Record<string, any> = {};
    for (const [k, v] of Object.entries(sanitized.custom_fields)) {
      if (!ownerOnlyKeys.has(k)) {
        cleanCustomFields[k] = v;
      }
    }
    sanitized.custom_fields = cleanCustomFields;
  }

  // Sanitize custom module record data
  if (sanitized.data && typeof sanitized.data === 'object') {
    const defs = fieldDefs || fileDb.read().field_definitions.filter(
      f => f.organization_id === record.organization_id && f.module_key === moduleKey
    );
    const ownerOnlyKeys = new Set(
      defs.filter(f => f.is_owner_only_view).map(f => f.field_key)
    );

    const cleanData: Record<string, any> = {};
    for (const [k, v] of Object.entries(sanitized.data)) {
      if (!ownerOnlyKeys.has(k)) {
        cleanData[k] = v;
      }
    }
    sanitized.data = cleanData;
  }

  return sanitized;
}
