'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Contact, 
  LeadSubmission, 
  CallLog, 
  Note, 
  Task, 
  Deal, 
  EmailMessage, 
  EmailTemplate, 
  Profile, 
  Role,
  CallOutcome,
  LifecycleStatus,
  FieldDefinition
} from '@/types/crm';
import { formatAdelaideDateTime } from '@/lib/utils/date';
import { formatAustralianPhone } from '@/lib/utils/normalization';
import { 
  Phone, 
  Mail, 
  Calendar, 
  Building2, 
  MapPin, 
  User, 
  Clock, 
  Send, 
  Plus, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Flame, 
  PhoneCall, 
  ChevronRight,
  ShieldAlert,
  ArrowLeft,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  Lock,
  Tag,
  Edit3,
  UserCheck,
  Archive,
  RotateCcw,
  CheckSquare
} from 'lucide-react';

interface ContactDetailClientProps {
  contact: Contact;
  fieldDefs?: FieldDefinition[];
  leads: LeadSubmission[];
  callLogs: CallLog[];
  notes: Note[];
  tasks: Task[];
  deals: Deal[];
  emails: EmailMessage[];
  templates: EmailTemplate[];
  profiles: Profile[];
  currentUser: Profile;
}

export function ContactDetailClient({
  contact: initialContact,
  fieldDefs = [],
  leads,
  callLogs: initialCalls,
  notes: initialNotes,
  tasks: initialTasks,
  deals: initialDeals,
  emails: initialEmails,
  templates,
  profiles,
  currentUser,
}: ContactDetailClientProps) {
  const [contact, setContact] = useState<Contact>(initialContact);
  const [callLogs, setCallLogs] = useState<CallLog[]>(initialCalls);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [emails, setEmails] = useState<EmailMessage[]>(initialEmails);

  // Secondary Information Tabs
  const [activeTab, setActiveTab] = useState<'timeline' | 'deals' | 'tasks' | 'calls' | 'notes' | 'emails'>('timeline');

  // Quick Action Modals
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // Custom Fields Edit Modal
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customFormData, setCustomFormData] = useState<Record<string, any>>({});
  const [customSaving, setCustomSaving] = useState(false);

  // Owner Quick Reassign Modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [targetAgentId, setTargetAgentId] = useState(contact.assigned_agent_id || '');
  const [reassignLoading, setReassignLoading] = useState(false);

  // Call form state
  const [callOutcome, setCallOutcome] = useState<CallOutcome>('connected');
  const [callDuration, setCallDuration] = useState('180');
  const [callNotes, setCallNotes] = useState('');
  const [callNextAction, setCallNextAction] = useState('Follow-up with course pack');
  const [callFollowUpDate, setCallFollowUpDate] = useState('');
  const [callSubmitting, setCallSubmitting] = useState(false);

  // Note form state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  // Email form state
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]?.slug || '');
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const [calling3CX, setCalling3CX] = useState(false);

  const isOwner = currentUser.role === 'owner';
  const assignedAgent = profiles.find(p => p.id === contact.assigned_agent_id);
  const isArchived = contact.is_archived || contact.lifecycle_status === 'archived';

  // Visible custom fields for this user
  const visibleFieldDefs = fieldDefs.filter(f => f.show_in_detail && (!f.is_owner_only_view || isOwner));
  const customFieldSections = Array.from(new Set(visibleFieldDefs.map(f => f.section || 'General Details')));

  // Change lifecycle stage
  const handleStatusChange = async (newStatus: LifecycleStatus) => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lifecycle_status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContact({ ...contact, lifecycle_status: newStatus });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setStatusLoading(false);
    }
  };

  // Toggle Do-Not-Call
  const toggleDNC = async () => {
    const nextDNC = !contact.do_not_call;
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ do_not_call: nextDNC }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContact({ ...contact, do_not_call: nextDNC });
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Reassign contact (Owner Only)
  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    setReassignLoading(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: targetAgentId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setContact({ ...contact, assigned_agent_id: targetAgentId || undefined });
      setReassignModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setReassignLoading(false);
    }
  };

  // Archive / Restore (Owner Only)
  const handleArchiveToggle = async () => {
    if (!isOwner) return;
    const action = isArchived ? 'restore' : 'archive';
    try {
      const res = await fetch(`/api/contacts/${contact.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setContact(data.contact);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Open Custom Fields Edit Modal
  const openCustomModal = () => {
    setCustomFormData({ ...(contact.custom_fields || {}) });
    setCustomModalOpen(true);
  };

  // Save Custom Fields
  const handleSaveCustomFields = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_fields: customFormData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setContact(data.contact);
      setCustomModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCustomSaving(false);
    }
  };

  // 3CX Call
  const handle3CXCall = async () => {
    setCalling3CX(true);
    try {
      const res = await fetch('/api/integrations/3cx/makecall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contact.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.dial_url && data.dial_url.startsWith('http')) {
        window.open(data.dial_url, '_blank', 'noopener,noreferrer');
      } else if (data.dial_url) {
        window.location.href = data.dial_url;
      }

      if (data.call_log_id) {
        const newCallLog: CallLog = {
          id: data.call_log_id,
          organization_id: contact.organization_id,
          contact_id: contact.id,
          agent_id: currentUser.id,
          timestamp: new Date().toISOString(),
          outcome: 'no_answer',
          duration_seconds: 0,
          provider: '3cx',
          provider_call_id: data.call_id,
          direction: 'outbound',
          call_status: 'in_progress' as any,
          agent_extension: data.agent_extension,
          notes: `3CX call initiated by ${currentUser.full_name} (Ext ${data.agent_extension}). Awaiting journal sync.`,
          created_at: new Date().toISOString(),
        };
        setCallLogs(prev => [newCallLog, ...prev]);
      }

      alert(data.message || '3CX Call Initiated');
    } catch (err: any) {
      alert(err.message || 'Failed to initiate 3CX call');
    } finally {
      setCalling3CX(false);
    }
  };

  // Log Call
  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setCallSubmitting(true);
    try {
      const res = await fetch('/api/calling/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contact.id,
          outcome: callOutcome,
          duration_seconds: parseInt(callDuration) || 0,
          notes: callNotes,
          next_action: callNextAction,
          follow_up_date: callFollowUpDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCallLogs([data.callLog, ...callLogs]);
      setCallModalOpen(false);
      setCallNotes('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCallSubmitting(false);
    }
  };

  // Add Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoteSubmitting(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setNotes([data.note, ...notes]);
      setNoteModalOpen(false);
      setNewNoteContent('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setNoteSubmitting(false);
    }
  };

  // Send Email
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSubmitting(true);
    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          recipientEmail: contact.email,
          templateSlug: selectedTemplate,
          agentName: currentUser.full_name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setEmails([data.emailRecord, ...emails]);
      setEmailModalOpen(false);
      alert('Email queued and sent successfully.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEmailSubmitting(false);
    }
  };

  // Build Unified Chronological Activity Timeline
  type TimelineItem = 
    | { type: 'lead'; date: string; data: LeadSubmission }
    | { type: 'call'; date: string; data: CallLog }
    | { type: 'note'; date: string; data: Note }
    | { type: 'task'; date: string; data: Task }
    | { type: 'deal'; date: string; data: Deal }
    | { type: 'email'; date: string; data: EmailMessage };

  const timelineItems: TimelineItem[] = [
    ...leads.map(l => ({ type: 'lead' as const, date: l.submission_timestamp, data: l })),
    ...callLogs.map(c => ({ type: 'call' as const, date: c.timestamp, data: c })),
    ...notes.map(n => ({ type: 'note' as const, date: n.created_at, data: n })),
    ...tasks.map(t => ({ type: 'task' as const, date: t.created_at, data: t })),
    ...deals.map(d => ({ type: 'deal' as const, date: d.created_at, data: d })),
    ...emails.map(e => ({ type: 'email' as const, date: e.created_at, data: e })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Breadcrumb & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/contacts"
            className="p-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors shadow-sm"
            title="Back to Directory"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[13px] text-slate-500 font-mono font-medium">Record: {contact.id}</span>
              <span className="text-[13px] text-slate-400">&bull; Adelaide Time (ACDT)</span>
              {isArchived && (
                <span className="px-2 py-0.5 rounded text-[11px] bg-slate-200 text-slate-700 font-bold uppercase">
                  Archived Record
                </span>
              )}
              {contact.conflict_flag && (
                <span className="px-2 py-0.5 rounded text-[11px] bg-amber-100 text-amber-800 font-bold border border-amber-200">
                  ⚠️ Conflicting Contact Match
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              {contact.full_name}
              {contact.do_not_call && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                  DO NOT CALL
                </span>
              )}
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {contact.phone_raw && (
            <button
              onClick={handle3CXCall}
              disabled={calling3CX || contact.do_not_call}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2.5 rounded-xl text-[15px] transition-colors shadow-sm disabled:opacity-50 min-h-[44px]"
            >
              <PhoneCall className="w-4 h-4" />
              <span>{calling3CX ? 'Connecting 3CX...' : 'Call with 3CX'}</span>
            </button>
          )}

          <button
            onClick={() => setCallModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-[#20409A] hover:bg-[#183279] text-white font-bold px-4 py-2.5 rounded-xl text-[15px] transition-colors shadow-sm min-h-[44px]"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Log Call</span>
          </button>

          <button
            onClick={() => setNoteModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-white hover:bg-slate-50 text-slate-800 font-semibold px-4 py-2.5 rounded-xl text-[15px] border border-slate-300 transition-colors shadow-sm min-h-[44px]"
          >
            <FileText className="w-4 h-4 text-[#20409A]" />
            <span>Add Note</span>
          </button>

          <button
            onClick={() => setEmailModalOpen(true)}
            disabled={contact.email_suppressed}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-white hover:bg-slate-50 text-slate-800 font-semibold px-4 py-2.5 rounded-xl text-[15px] border border-slate-300 transition-colors shadow-sm disabled:opacity-50 min-h-[44px]"
          >
            <Mail className="w-4 h-4 text-[#20409A]" />
            <span>Send Email</span>
          </button>

          {isOwner && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <button
                onClick={() => {
                  setTargetAgentId(contact.assigned_agent_id || '');
                  setReassignModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-blue-50 hover:bg-blue-100 text-[#20409A] border border-blue-200 font-bold px-3 py-2.5 rounded-xl text-sm transition-colors shadow-sm min-h-[44px]"
                title="Reassign to another advisor"
              >
                <UserCheck className="w-4 h-4" />
                <span>Reassign</span>
              </button>

              <button
                onClick={handleArchiveToggle}
                className="inline-flex items-center justify-center p-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-600 transition-colors shadow-sm min-h-[44px]"
                title={isArchived ? 'Restore Record' : 'Archive Record'}
              >
                {isArchived ? <RotateCcw className="w-4 h-4 text-blue-600" /> : <Archive className="w-4 h-4 text-rose-600" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main 2-Column Responsive Layout (Section 4 Specification) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Contact Identity, Course Enquiry & Custom Properties */}
        <div className="space-y-6">
          {/* Card 1: Identity & Assignment */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2">
              Student / Candidate Details
            </h3>

            <div className="space-y-3.5 text-base">
              <div>
                <span className="text-slate-500 block text-xs font-semibold">Email Address</span>
                <span className="font-mono text-slate-900 font-medium select-all text-sm">{contact.email}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-xs font-semibold">Telephone (Australia)</span>
                <span className="font-mono text-slate-900 font-bold select-all text-sm">
                  {formatAustralianPhone(contact.phone_raw || contact.phone_normalized)}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-xs font-semibold">Company / Trade</span>
                <span className="font-medium text-slate-800 text-sm">{contact.company || 'Private Enrolment'}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-xs font-semibold">Location</span>
                <span className="font-medium text-slate-800 text-sm">
                  {contact.city || 'Adelaide'}, {contact.country || 'Australia'} {contact.state_or_postcode ? `(${contact.state_or_postcode})` : ''}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-xs font-semibold">Assigned Advisor</span>
                <div className="flex items-center gap-2 mt-1">
                  {assignedAgent ? (
                    <>
                      <div className="w-7 h-7 rounded-full bg-[#20409A] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                        {assignedAgent.full_name.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900 text-sm">{assignedAgent.full_name}</span>
                    </>
                  ) : (
                    <span className="text-amber-700 font-bold text-sm italic">Unassigned</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-xs font-semibold mb-1.5">Lifecycle Stage</span>
                <div className="flex flex-wrap gap-2">
                  {(['lead', 'contact', 'customer', 'archived'] as LifecycleStatus[]).map(st => (
                    <button
                      key={st}
                      disabled={statusLoading}
                      onClick={() => handleStatusChange(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                        contact.lifecycle_status === st
                          ? 'bg-[#20409A] text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {st === 'customer' ? 'Enrolled' : st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={toggleDNC}
                  className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold transition-all border ${
                    contact.do_not_call 
                      ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                      : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {contact.do_not_call ? '✓ Marked as Do Not Call' : 'Mark as Do Not Call'}
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Course Enquiry */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3.5 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>Course Enquiry Details</span>
              <BookOpen className="w-4 h-4 text-[#20409A]" />
            </h3>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500 block text-xs font-semibold">Qualification Title</span>
                <span className="font-bold text-[#20409A] block mt-0.5 text-base">
                  {contact.course_interest || 'Certificate IV in Building and Construction'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-xs font-semibold">Delivery Variant</span>
                <span className="font-medium text-slate-800">
                  {contact.delivery_variant || 'Self-Paced Online'}
                </span>
              </div>

              {contact.course_review_required && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 font-medium">
                  ⚠️ This enquiry contained a non-standard course name and requires advisor review.
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Configured Custom Properties (Grouped by Sections) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-900" />
                Custom Properties
              </h3>
              <button
                onClick={openCustomModal}
                className="text-xs font-bold text-[#20409A] hover:underline flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Values
              </button>
            </div>

            {visibleFieldDefs.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No custom fields defined for contacts.</p>
            ) : (
              <div className="space-y-4">
                {customFieldSections.map(section => {
                  const sFields = visibleFieldDefs.filter(f => (f.section || 'General Details') === section);
                  if (sFields.length === 0) return null;

                  return (
                    <div key={section} className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 bg-blue-50/60 px-2.5 py-1 rounded-md">
                        {section}
                      </h4>

                      <div className="space-y-2 text-sm pl-1">
                        {sFields.map(field => {
                          const val = contact.custom_fields?.[field.field_key];

                          let display = 'Not specified';
                          if (val !== undefined && val !== null && val !== '') {
                            if (field.field_type === 'checkbox') {
                              display = val ? 'Yes' : 'No';
                            } else if (Array.isArray(val)) {
                              display = val.join(', ');
                            } else {
                              display = String(val);
                            }
                          }

                          return (
                            <div key={field.id} className="border-b border-slate-50 pb-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 text-xs font-medium">
                                  {field.label}
                                </span>
                                {field.is_owner_only_view && (
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                    🔒 Owner Only
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-900 font-semibold text-sm mt-0.5">
                                {field.field_type === 'checkbox' ? (
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    val ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {display}
                                  </span>
                                ) : (
                                  display
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card 4: Milestones (Adelaide Time) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2">
              Timeline Milestones (Adelaide Time)
            </h3>
            <div className="text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">First Enquiry:</span>
                <span className="text-slate-800 font-mono text-xs">{formatAdelaideDateTime(contact.first_enquiry_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Latest Enquiry:</span>
                <span className="text-[#20409A] font-bold font-mono text-xs">{formatAdelaideDateTime(contact.latest_enquiry_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Last Contacted:</span>
                <span className="text-slate-800 font-mono text-xs">{formatAdelaideDateTime(contact.last_contacted_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Next Follow-up:</span>
                <span className="text-amber-700 font-bold font-mono text-xs">{formatAdelaideDateTime(contact.next_follow_up_at)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Secondary Information in Clean Tabs (Section 4 Specification) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Secondary Tab Navigation */}
          <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'timeline'
                  ? 'bg-[#20409A] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-4 h-4" /> Activity Timeline ({timelineItems.length})
            </button>

            <button
              onClick={() => setActiveTab('deals')}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'deals'
                  ? 'bg-[#20409A] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-4 h-4" /> Opportunities ({deals.length})
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'tasks'
                  ? 'bg-[#20409A] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CheckSquare className="w-4 h-4" /> Follow-ups ({tasks.length})
            </button>

            <button
              onClick={() => setActiveTab('calls')}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'calls'
                  ? 'bg-[#20409A] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <PhoneCall className="w-4 h-4" /> Call Records ({callLogs.length})
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'notes'
                  ? 'bg-[#20409A] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" /> Internal Notes ({notes.length})
            </button>

            <button
              onClick={() => setActiveTab('emails')}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'emails'
                  ? 'bg-[#20409A] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Mail className="w-4 h-4" /> Emails ({emails.length})
            </button>
          </div>

          {/* TAB 1: ACTIVITY TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Chronological Activity Stream
                  </h3>
                  <p className="text-sm text-slate-500">
                    All student interactions, calls, stage progressions, and emails.
                  </p>
                </div>
                <span className="text-xs text-[#20409A] font-mono font-bold bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                  {timelineItems.length} events
                </span>
              </div>

              <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pl-6">
                {timelineItems.map((item, idx) => {
                  if (item.type === 'lead') {
                    const lead = item.data;
                    return (
                      <div key={lead.id} className="relative group">
                        <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-[#20409A] border-4 border-white shadow-sm" />
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-[#20409A] flex items-center gap-2">
                              <Flame className="w-4 h-4 text-amber-500" />
                              Enquiry Touchpoint ({lead.capture_channel})
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              {formatAdelaideDateTime(lead.submission_timestamp)}
                            </span>
                          </div>
                          <div className="text-sm text-slate-700 space-y-1">
                            <div>
                              <span className="text-slate-500">Source: </span>
                              <span className="capitalize font-bold text-slate-900">{lead.marketing_source}</span>
                              {lead.campaign_name && <span className="text-slate-500"> &bull; Campaign: {lead.campaign_name}</span>}
                            </div>
                            {lead.submitted_fields && Object.keys(lead.submitted_fields).length > 0 && (
                              <div className="mt-3 p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                                <div className="text-[11px] uppercase font-bold text-slate-500 mb-1">Submitted Form Fields</div>
                                {Object.entries(lead.submitted_fields).map(([k, v]) => (
                                  <div key={k} className="flex justify-between py-0.5">
                                    <span className="text-slate-500 font-medium">{k}:</span>
                                    <span className="text-slate-900 font-semibold">{String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (item.type === 'call') {
                    const call = item.data;
                    const agent = profiles.find(p => p.id === call.agent_id);
                    return (
                      <div key={call.id} className="relative group">
                        <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-emerald-600 border-4 border-white shadow-sm" />
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                              <PhoneCall className="w-4 h-4 text-emerald-600" />
                              Call Outcome: <span className="capitalize">{call.outcome.replace('_', ' ')}</span>
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              {formatAdelaideDateTime(call.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-800">{call.notes || 'No call notes recorded.'}</p>
                          <div className="text-xs text-slate-500 pt-2 border-t border-slate-200 flex items-center justify-between">
                            <span>Advisor: <strong>{agent?.full_name || 'Advisor'}</strong></span>
                            <span>Duration: <strong>{call.duration_seconds}s</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (item.type === 'note') {
                    const note = item.data;
                    const author = profiles.find(p => p.id === note.author_id);
                    return (
                      <div key={note.id} className="relative group">
                        <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white shadow-sm" />
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                              <FileText className="w-4 h-4 text-indigo-600" />
                              Advisory Note by {author?.full_name.split(' ')[0] || 'User'}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              {formatAdelaideDateTime(note.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-800 whitespace-pre-wrap">{note.content}</p>
                        </div>
                      </div>
                    );
                  }

                  if (item.type === 'email') {
                    const email = item.data;
                    return (
                      <div key={email.id} className="relative group">
                        <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-sm" />
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-blue-900 flex items-center gap-2">
                              <Mail className="w-4 h-4 text-blue-600" />
                              Email: {email.subject}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              {formatAdelaideDateTime(email.created_at)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600">
                            Recipient: <span className="font-mono text-slate-900">{email.recipient_email}</span> &bull; Status: <strong className="text-blue-900 capitalize">{email.status}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (item.type === 'deal') {
                    const deal = item.data;
                    return (
                      <div key={deal.id} className="relative group">
                        <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-purple-600 border-4 border-white shadow-sm" />
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-purple-900 flex items-center gap-2">
                              <GraduationCap className="w-4 h-4 text-purple-600" />
                              Pipeline: {deal.title}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              {formatAdelaideDateTime(deal.created_at)}
                            </span>
                          </div>
                          <div className="text-sm text-slate-700">
                            Stage: <strong className="capitalize text-slate-900">{deal.stage.replace('_', ' ')}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}

                {timelineItems.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    No activity recorded for this candidate yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DEALS / PIPELINE */}
          {activeTab === 'deals' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-900">
                Course Enquiry Pipeline Opportunities ({deals.length})
              </h3>
              {deals.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No active pipeline deals for this contact.</p>
              ) : (
                <div className="space-y-3">
                  {deals.map(deal => (
                    <div key={deal.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-base">{deal.title}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 capitalize">
                          {deal.stage.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Course Code: <span className="font-mono text-slate-800 font-bold">{deal.course_code || 'CPC'}</span> &bull; Format: {deal.delivery_variant || 'Online'}
                      </div>
                      {deal.notes && <p className="text-sm text-slate-700 mt-1">{deal.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TASKS */}
          {activeTab === 'tasks' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-900">
                Follow-up &amp; Callback Tasks ({tasks.length})
              </h3>
              {tasks.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No tasks scheduled for this contact.</p>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => (
                    <div key={task.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-base">{task.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Due: <span className="font-mono text-slate-800">{formatAdelaideDateTime(task.due_date)}</span> &bull; Priority: <strong className="capitalize">{task.priority}</strong>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                        task.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CALLS */}
          {activeTab === 'calls' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-900">
                Recorded Phone Calls &amp; 3CX Journals ({callLogs.length})
              </h3>
              {callLogs.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No call logs recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {callLogs.map(call => (
                    <div key={call.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm capitalize">
                          Outcome: {call.outcome.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          {formatAdelaideDateTime(call.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{call.notes || 'No notes'}</p>
                      <div className="text-xs text-slate-500 pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span>Provider: <strong className="uppercase">{call.provider || 'manual'}</strong></span>
                        <span>Duration: {call.duration_seconds}s</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: NOTES */}
          {activeTab === 'notes' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                  Internal Advisory Notes ({notes.length})
                </h3>
                <button
                  onClick={() => setNoteModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#20409A] hover:bg-[#183279] text-white text-xs font-bold transition-colors"
                >
                  + Add Note
                </button>
              </div>

              {notes.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No internal notes written yet.</p>
              ) : (
                <div className="space-y-3">
                  {notes.map(note => {
                    const author = profiles.find(p => p.id === note.author_id);
                    return (
                      <div key={note.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-semibold text-slate-800">{author?.full_name || 'Advisor'}</span>
                          <span className="font-mono">{formatAdelaideDateTime(note.created_at)}</span>
                        </div>
                        <p className="text-sm text-slate-900 whitespace-pre-wrap">{note.content}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: EMAILS */}
          {activeTab === 'emails' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                  Email Communications ({emails.length})
                </h3>
                <button
                  onClick={() => setEmailModalOpen(true)}
                  disabled={contact.email_suppressed}
                  className="px-3.5 py-1.5 rounded-xl bg-[#20409A] hover:bg-[#183279] text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  Send Email
                </button>
              </div>

              {emails.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No emails logged for this contact.</p>
              ) : (
                <div className="space-y-3">
                  {emails.map(email => (
                    <div key={email.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">{email.subject}</span>
                        <span className="text-xs text-slate-500 font-mono">{formatAdelaideDateTime(email.created_at)}</span>
                      </div>
                      <div className="text-xs text-slate-600">
                        To: {email.recipient_email} &bull; Status: <strong className="capitalize text-blue-900">{email.status}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: EDIT CUSTOM PROPERTIES */}
      {customModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-900" />
                Edit Custom Properties
              </h2>
              <button
                onClick={() => setCustomModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCustomFields} className="space-y-4">
              {visibleFieldDefs.map(field => {
                const isReadOnly = !isOwner && field.is_owner_only_edit;
                const fieldVal = customFormData[field.field_key] ?? '';

                return (
                  <div key={field.id} className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-700">
                      {field.label} {field.is_required && <span className="text-rose-600">*</span>}
                      {field.is_owner_only_edit && !isOwner && (
                        <span className="text-xs text-amber-700 font-normal ml-1.5">(Read only)</span>
                      )}
                    </label>

                    {field.field_type === 'short_text' && (
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={fieldVal}
                        onChange={e => setCustomFormData({ ...customFormData, [field.field_key]: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-slate-100"
                      />
                    )}

                    {field.field_type === 'long_text' && (
                      <textarea
                        rows={3}
                        disabled={isReadOnly}
                        value={fieldVal}
                        onChange={e => setCustomFormData({ ...customFormData, [field.field_key]: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-slate-100"
                      />
                    )}

                    {field.field_type === 'single_select' && (
                      <select
                        disabled={isReadOnly}
                        value={fieldVal}
                        onChange={e => setCustomFormData({ ...customFormData, [field.field_key]: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-slate-100"
                      >
                        <option value="">— Select {field.label} —</option>
                        {field.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {field.field_type === 'checkbox' && (
                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          disabled={isReadOnly}
                          checked={Boolean(customFormData[field.field_key])}
                          onChange={e => setCustomFormData({ ...customFormData, [field.field_key]: e.target.checked })}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-800">
                          {field.help_text || field.label}
                        </span>
                      </label>
                    )}
                  </div>
                );
              })}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCustomModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={customSaving}
                  className="bg-[#20409A] hover:bg-[#183279] text-white px-5 py-2 text-sm font-semibold rounded-xl shadow transition-colors disabled:opacity-50"
                >
                  {customSaving ? 'Saving...' : 'Save Properties'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: OWNER REASSIGN */}
      {reassignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-900" /> Reassign Candidate
              </h3>
              <button
                onClick={() => setReassignModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Reassign <strong className="text-slate-900">{contact.full_name}</strong> to a different admissions advisor. Open pipeline deals and follow-up tasks will also be transferred.
            </p>

            <form onSubmit={handleReassign} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Assign To Advisor:
                </label>
                <select
                  value={targetAgentId}
                  onChange={e => setTargetAgentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-[15px] font-medium text-slate-900 focus:outline-none focus:border-[#20409A]"
                >
                  <option value="">— Move to Unassigned Queue —</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.role === 'owner' ? 'Owner' : 'Calling Agent'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReassignModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassignLoading}
                  className="bg-[#20409A] hover:bg-[#183279] text-white px-5 py-2 text-sm font-semibold rounded-xl shadow transition-colors disabled:opacity-50"
                >
                  {reassignLoading ? 'Reassigning...' : 'Save Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log Call */}
      {callModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-[#20409A]" />
                Log Call — {contact.full_name}
              </h3>
              <button onClick={() => setCallModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
            </div>

            <form onSubmit={handleLogCall} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Call Outcome *</label>
                <select
                  value={callOutcome}
                  onChange={e => setCallOutcome(e.target.value as CallOutcome)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium"
                >
                  <option value="connected">Connected (Conversation held)</option>
                  <option value="interested">Interested (Lead Qualified)</option>
                  <option value="callback_requested">Callback Requested</option>
                  <option value="appointment_booked">Appointment / Counseling Booked</option>
                  <option value="no_answer">No Answer</option>
                  <option value="busy">Busy / Line Engaged</option>
                  <option value="wrong_number">Wrong Number</option>
                  <option value="not_interested">Not Interested</option>
                  <option value="do_not_call">Do Not Call (Compliance Opt-Out)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Duration (Seconds)</label>
                  <input
                    type="number"
                    value={callDuration}
                    onChange={e => setCallDuration(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Next Action</label>
                  <input
                    type="text"
                    value={callNextAction}
                    onChange={e => setCallNextAction(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Schedule Follow-up Date (Adelaide Time)</label>
                <input
                  type="datetime-local"
                  value={callFollowUpDate}
                  onChange={e => setCallFollowUpDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Discussion Summary</label>
                <textarea
                  rows={3}
                  value={callNotes}
                  onChange={e => setCallNotes(e.target.value)}
                  placeholder="Record what was discussed with the student..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCallModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={callSubmitting}
                  className="bg-[#20409A] hover:bg-[#183279] text-white font-bold px-5 py-2.5 rounded-xl text-sm"
                >
                  {callSubmitting ? 'Saving...' : 'Save Call Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Note */}
      {noteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">Add Internal Note</h3>
              <button onClick={() => setNoteModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={handleAddNote} className="space-y-4">
              <textarea
                rows={4}
                required
                value={newNoteContent}
                onChange={e => setNewNoteContent(e.target.value)}
                placeholder="Write an internal advisory note regarding this candidate..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-sm text-slate-900"
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNoteModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={noteSubmitting}
                  className="bg-[#20409A] hover:bg-[#183279] text-white font-bold px-5 py-2.5 rounded-xl text-sm"
                >
                  {noteSubmitting ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Send Email */}
      {emailModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">Send Email to {contact.full_name}</h3>
              <button onClick={() => setEmailModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Approved Template</label>
                <select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailSubmitting}
                  className="bg-[#20409A] hover:bg-[#183279] text-white font-bold px-5 py-2.5 rounded-xl text-sm"
                >
                  {emailSubmitting ? 'Queueing...' : 'Dispatch Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
