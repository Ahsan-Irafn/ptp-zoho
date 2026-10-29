import { Profile, Contact, Deal, Task, CallLog, Role } from '@/types/crm';

export interface UserSession {
  user: Profile;
  organizationId: string;
}

export const permissions = {
  // Contacts
  canViewAllContacts(role: Role): boolean {
    return role === 'owner';
  },

  canAccessContact(role: Role, userId: string, contact?: Contact): boolean {
    if (!contact) return false;
    if (role === 'owner') return true;
    return contact.assigned_agent_id === userId;
  },

  canDeleteContact(role: Role): boolean {
    return role === 'owner';
  },

  canMergeContacts(role: Role): boolean {
    return role === 'owner';
  },

  canReassignContact(role: Role): boolean {
    return role === 'owner';
  },

  // Deals
  canAccessDeal(role: Role, userId: string, deal?: Deal): boolean {
    if (!deal) return false;
    if (role === 'owner') return true;
    return deal.assigned_agent_id === userId;
  },

  // Tasks
  canAccessTask(role: Role, userId: string, task?: Task): boolean {
    if (!task) return false;
    if (role === 'owner') return true;
    return task.assigned_agent_id === userId;
  },

  // Integrations & Secrets
  canManageIntegrations(role: Role): boolean {
    return role === 'owner';
  },

  // Users & Team Management
  canManageTeam(role: Role): boolean {
    return role === 'owner';
  },

  // Audit Logs
  canViewAuditLogs(role: Role): boolean {
    return role === 'owner';
  },

  // Reports
  canViewExecutiveReports(role: Role): boolean {
    return role === 'owner';
  },

  canExportDatabase(role: Role): boolean {
    return role === 'owner';
  },

  // Templates
  canManageTemplates(role: Role): boolean {
    return role === 'owner';
  },

  // Calling & Communication
  canLogCall(role: Role, userId: string, contact?: Contact): boolean {
    return this.canAccessContact(role, userId, contact);
  },

  canSendApprovedEmail(role: Role, userId: string, contact?: Contact): boolean {
    if (!contact) return false;
    if (contact.email_suppressed) return false;
    return this.canAccessContact(role, userId, contact);
  }
};
