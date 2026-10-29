import React from 'react';
import { requireOwner } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { TeamClient } from '@/components/team/TeamClient';

export default async function TeamPage() {
  const currentUser = await requireOwner();
  const org = db.organizations.findFirst();
  if (!org) return <div>Organization not found</div>;

  const profiles = db.profiles.findMany(org.id);
  const invitations = db.invitations.findMany(org.id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return (
    <div className="max-w-7xl mx-auto">
      <TeamClient
        initialProfiles={profiles}
        initialInvitations={invitations}
        appUrl={appUrl}
      />
    </div>
  );
}
