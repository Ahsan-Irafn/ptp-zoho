import React from 'react';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { EmailsClient } from '@/components/emails/EmailsClient';

export default async function EmailsPage() {
  const currentUser = await requireUser();
  const org = db.organizations.findFirst();
  if (!org) return <div>Organization not found</div>;

  const templates = db.emailTemplates.findMany(org.id);
  const messages = db.emailMessages.findMany(org.id);
  const suppressions = db.suppressions.findMany(org.id);

  return (
    <div className="max-w-7xl mx-auto">
      <EmailsClient
        initialTemplates={templates}
        initialMessages={messages}
        suppressions={suppressions}
        currentUser={currentUser}
      />
    </div>
  );
}
