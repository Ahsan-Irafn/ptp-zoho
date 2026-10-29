import React from 'react';
import { requireOwner } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { ModulesAndFieldsClient } from '@/components/settings/ModulesAndFieldsClient';

export default async function ModulesAndFieldsPage() {
  const currentUser = await requireOwner();
  const org = db.organizations.findFirst();
  if (!org) return <div>Organization not found</div>;

  const modules = db.modules.findMany(org.id, { includeDisabled: true });
  const fields = db.fields.findMany(org.id, undefined, { includeArchived: true });

  return (
    <div className="max-w-7xl mx-auto">
      <ModulesAndFieldsClient
        initialModules={modules}
        initialFields={fields}
        currentUser={currentUser}
        organization={org}
      />
    </div>
  );
}
