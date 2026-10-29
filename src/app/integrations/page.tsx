import React from 'react';
import { requireOwner } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { IntegrationsClient } from '@/components/integrations/IntegrationsClient';

export default async function IntegrationsPage() {
  // Strict Owner Permission Check
  const currentUser = await requireOwner();
  const org = db.organizations.findFirst();
  if (!org) return <div>Organization not found</div>;

  const integrations = db.integrations.findMany(org.id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return (
    <div className="max-w-7xl mx-auto">
      <IntegrationsClient
        initialIntegrations={integrations}
        appUrl={appUrl}
      />
    </div>
  );
}
