import React from 'react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { permissions } from '@/lib/auth/permissions';
import { ContactDetailClient } from '@/components/contacts/ContactDetailClient';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const currentUser = await requireUser();
  const org = db.organizations.findFirst();
  if (!org) return <div>Organization not found</div>;

  const contact = db.contacts.findById(params.id);

  // If contact does not exist
  if (!contact) {
    return (
      <div className="min-h-[500px] flex items-center justify-center p-6 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full">
          <h2 className="text-xl font-bold text-white mb-2">Contact Not Found</h2>
          <p className="text-xs text-slate-400 mb-6">The contact record #{params.id} does not exist in the database.</p>
          <Link href="/contacts" className="inline-flex items-center gap-2 text-xs font-semibold text-teal-400 hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Contacts
          </Link>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STRICT PERMISSION CHECK:
  // Calling Agents (Ayesha or Maryam) CANNOT access another agent's records by guessing IDs!
  // =========================================================================
  const hasAccess = permissions.canAccessContact(currentUser.role, currentUser.id, contact);
  if (!hasAccess) {
    return (
      <div className="min-h-[500px] flex items-center justify-center p-6 text-center">
        <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="w-14 h-14 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied (403 Forbidden)</h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            You do not have permission to view contact <strong>#{contact.id}</strong>.
            Calling agents are only authorized to access contacts and leads assigned to them.
          </p>
          <Link
            href="/contacts"
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to My Contacts
          </Link>
        </div>
      </div>
    );
  }

  // Fetch all timeline associations
  const leads = db.leads.findMany(org.id, contact.id);
  const callLogs = db.callLogs.findByContactId(contact.id);
  const notes = db.notes.findByContactId(contact.id);
  const tasks = db.tasks.findByContactId(contact.id);
  const deals = db.deals.findByContactId(contact.id);
  const emails = db.emailMessages.findMany(org.id, contact.id);
  const templates = db.emailTemplates.findMany(org.id).filter(t => t.is_active);
  const profiles = db.profiles.findMany(org.id);

  // Field-level server authorization
  const fieldDefs = db.fields.findMany(org.id, 'contacts', { role: currentUser.role });
  const sanitizedContact = sanitizeRecordForRole('contacts', contact, currentUser.role, fieldDefs);

  return (
    <ContactDetailClient
      contact={sanitizedContact}
      fieldDefs={fieldDefs}
      leads={leads}
      callLogs={callLogs}
      notes={notes}
      tasks={tasks}
      deals={deals}
      emails={emails}
      templates={templates}
      profiles={profiles}
      currentUser={currentUser}
    />
  );
}
