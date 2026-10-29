import React from 'react';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { DealsClient } from '@/components/deals/DealsClient';

export default async function DealsPage() {
  const currentUser = await requireUser();
  const org = db.organizations.findFirst();
  if (!org) return <div>Organization not found</div>;

  const isOwner = currentUser.role === 'owner';

  // Strict permission filter
  const deals = db.deals.findMany(
    org.id, 
    isOwner ? undefined : currentUser.id
  );

  const contacts = db.contacts.findMany(
    org.id, 
    isOwner ? undefined : { agentId: currentUser.id }
  );

  const profiles = db.profiles.findMany(org.id);

  return (
    <div className="max-w-7xl mx-auto">
      <DealsClient
        initialDeals={deals}
        contacts={contacts}
        profiles={profiles}
        currentUser={currentUser}
      />
    </div>
  );
}
