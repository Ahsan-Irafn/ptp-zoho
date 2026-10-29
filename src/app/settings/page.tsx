import React from 'react';
import { requireOwner } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { SettingsClient } from '@/components/settings/SettingsClient';

export default async function SettingsPage() {
  const currentUser = await requireOwner();
  const org = db.organizations.findFirst();
  if (!org) return <div>Organization not found</div>;

  return (
    <div className="max-w-7xl mx-auto">
      <SettingsClient organization={org} />
    </div>
  );
}
