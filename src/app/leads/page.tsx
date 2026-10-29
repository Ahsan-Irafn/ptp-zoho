import React from 'react';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { LeadsClient } from '@/components/leads/LeadsClient';

export default async function LeadsPage() {
  const currentUser = await requireUser();
  const org = db.organizations.findFirst();
  if (!org) return <div>Organization not found</div>;

  const isOwner = currentUser.role === 'owner';

  // Load contacts based on role
  // Owners: full view of all contacts (assigned, unassigned, archived)
  // Calling agents (Ayesha/Maryam): strictly scoped to their assigned active contacts
  const contacts = db.contacts.findMany(
    org.id,
    isOwner ? { isArchived: true } : { agentId: currentUser.id }
  );

  const contactIds = new Set(contacts.map(c => c.id));

  // Load submissions
  const allSubmissions = db.leads.findMany(org.id);
  const permittedSubmissions = isOwner
    ? allSubmissions
    : allSubmissions.filter(s => contactIds.has(s.contact_id));

  // Load profiles for advisor names and filters
  const profiles = db.users.findMany(org.id);

  // Load field definitions for leads module
  const fieldDefs = db.fields.findMany(org.id, 'leads');

  return (
    <LeadsClient
      initialSubmissions={permittedSubmissions}
      contacts={contacts}
      profiles={profiles}
      currentUserRole={currentUser.role}
      currentUserId={currentUser.id}
      fieldDefs={fieldDefs}
    />
  );
}
