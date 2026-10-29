import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { db, sanitizeRecordForRole } from '@/lib/db';
import { CustomModuleClient } from '@/components/modules/CustomModuleClient';

export default async function CustomModulePage({
  params,
}: {
  params: { key: string };
}) {
  const currentUser = await requireUser();
  const org = db.organizations.findFirst();
  if (!org) return <div>Organization not found</div>;

  const moduleDef = db.modules.findByKey(org.id, params.key);
  if (!moduleDef || (!moduleDef.is_enabled && currentUser.role !== 'owner')) {
    notFound();
  }

  // Access check
  if (currentUser.role === 'agent' && moduleDef.agent_access === 'none') {
    redirect('/dashboard');
  }

  const fieldDefs = db.fields.findMany(org.id, params.key, {
    role: currentUser.role,
  });

  const agentId = currentUser.role === 'agent' && moduleDef.agent_access === 'assigned_only' 
    ? currentUser.id 
    : undefined;

  const rawRecords = db.customRecords.findMany(org.id, params.key, {
    agentId,
  });

  const records = rawRecords.map(r => sanitizeRecordForRole(params.key, r, currentUser.role, fieldDefs));
  const profiles = db.profiles.findMany(org.id);

  return (
    <div className="max-w-7xl mx-auto">
      <CustomModuleClient
        moduleDef={moduleDef}
        fieldDefs={fieldDefs}
        initialRecords={records}
        profiles={profiles}
        currentUser={currentUser}
      />
    </div>
  );
}
