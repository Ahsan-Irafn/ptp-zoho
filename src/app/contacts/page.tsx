import React from 'react';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { ContactsClient } from '@/components/contacts/ContactsClient';

export default async function ContactsPage() {
  const currentUser = await requireUser();
  const org = db.organizations.findFirst();
  if (!org) return <div>Organization not found</div>;

  const isOwner = currentUser.role === 'owner';

  // Strict Permission Filter:
  // Owners see All Contacts (active + unassigned + archived)
  // Calling Agents see ONLY non-archived contacts assigned to them
  const activeContacts = db.contacts.findMany(
    org.id, 
    isOwner ? { isArchived: false } : { agentId: currentUser.id, isArchived: false }
  );
  const archivedContacts = isOwner 
    ? db.contacts.findMany(org.id, { isArchived: true })
    : [];
  const contacts = [...activeContacts, ...archivedContacts];

  const fieldDefs = db.fields.findMany(org.id, 'contacts', {
    role: currentUser.role,
  });

  const profiles = db.profiles.findMany(org.id);

  return (
    <div className="max-w-7xl mx-auto">
      <ContactsClient
        initialContacts={contacts}
        fieldDefs={fieldDefs}
        profiles={profiles}
        currentUserRole={currentUser.role}
        currentUserId={currentUser.id}
      />
    </div>
  );
}
