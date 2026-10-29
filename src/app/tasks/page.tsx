import React from 'react';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { TasksClient } from '@/components/tasks/TasksClient';

export default async function TasksPage() {
  const currentUser = await requireUser();
  const org = db.organizations.findFirst();
  if (!org) return <div>Organization not found</div>;

  const isOwner = currentUser.role === 'owner';

  // Permission-scoped tasks
  const tasks = db.tasks.findMany(
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
      <TasksClient
        initialTasks={tasks}
        contacts={contacts}
        profiles={profiles}
        currentUser={currentUser}
      />
    </div>
  );
}
