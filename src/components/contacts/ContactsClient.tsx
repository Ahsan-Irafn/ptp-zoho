'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Contact, Profile, Role, FieldDefinition } from '@/types/crm';
import { formatAdelaideDateTime } from '@/lib/utils/date';
import { formatAustralianPhone } from '@/lib/utils/normalization';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Phone, 
  Mail, 
  Tag, 
  AlertCircle, 
  Calendar,
  ExternalLink,
  ChevronRight,
  GitMerge,
  BookOpen,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Archive,
  RotateCcw,
  UserCheck,
  Copy,
  Check,
  SlidersHorizontal,
  Lock
} from 'lucide-react';

interface ContactsClientProps {
  initialContacts: Contact[];
  fieldDefs?: FieldDefinition[];
  profiles: Profile[];
  currentUserRole: Role;
  currentUserId: string;
}

export function ContactsClient({
  initialContacts,
  fieldDefs = [],
  profiles,
  currentUserRole,
  currentUserId,
}: ContactsClientProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [searchTerm, setSearchTerm] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  
  // Specification Owner Lead Views:
  // 'all' (default), 'ayesha', 'maryam', 'unassigned', 'archived'
  const [ownerLeadView, setOwnerLeadView] = useState<'all' | 'ayesha' | 'maryam' | 'unassigned' | 'archived'>('all');

  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [primaryId, setPrimaryId] = useState('');
  const [duplicateId, setDuplicateId] = useState('');
  const [mergeLoading, setMergeLoading] = useState(false);

  // Quick reassign modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignContact, setReassignContact] = useState<Contact | null>(null);
  const [targetAgentId, setTargetAgentId] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);

  // Quick copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isOwner = currentUserRole === 'owner';

  // Identify Ayesha & Maryam profiles
  const ayeshaProfile = profiles.find(p => p.email.toLowerCase().includes('ayesha') || p.full_name.toLowerCase().includes('ayesha'));
  const maryamProfile = profiles.find(p => p.email.toLowerCase().includes('maryam') || p.full_name.toLowerCase().includes('maryam'));

  // Custom fields configured to show in table
  const tableCustomFields = fieldDefs.filter(f => f.show_in_table && (!f.is_owner_only_view || isOwner));

  // Compute counts for Owner Lead Views
  const countAll = contacts.filter(c => !c.is_archived && c.lifecycle_status !== 'archived').length;
  const countAyesha = ayeshaProfile ? contacts.filter(c => !c.is_archived && c.lifecycle_status !== 'archived' && c.assigned_agent_id === ayeshaProfile.id).length : 0;
  const countMaryam = maryamProfile ? contacts.filter(c => !c.is_archived && c.lifecycle_status !== 'archived' && c.assigned_agent_id === maryamProfile.id).length : 0;
  const countUnassigned = contacts.filter(c => !c.is_archived && c.lifecycle_status !== 'archived' && !c.assigned_agent_id).length;
  const countArchived = contacts.filter(c => c.is_archived || c.lifecycle_status === 'archived').length;

  // Filter contacts based on Owner Lead Views, search, and lifecycle
  const filteredContacts = contacts.filter(c => {
    // 1. Owner Lead Views Filter
    if (isOwner) {
      if (ownerLeadView === 'archived') {
        if (!c.is_archived && c.lifecycle_status !== 'archived') return false;
      } else {
        // Active views exclude archived
        if (c.is_archived || c.lifecycle_status === 'archived') return false;

        if (ownerLeadView === 'ayesha' && ayeshaProfile) {
          if (c.assigned_agent_id !== ayeshaProfile.id) return false;
        } else if (ownerLeadView === 'maryam' && maryamProfile) {
          if (c.assigned_agent_id !== maryamProfile.id) return false;
        } else if (ownerLeadView === 'unassigned') {
          if (c.assigned_agent_id) return false;
        }
      }

      // Secondary Agent dropdown filter (if not already handled by tabs)
      if (agentFilter !== 'all') {
        if (agentFilter === 'unassigned') {
          if (c.assigned_agent_id) return false;
        } else {
          if (c.assigned_agent_id !== agentFilter) return false;
        }
      }
    } else {
      // Calling Agent Boundary: never see archived, only see assigned
      if (c.is_archived || c.lifecycle_status === 'archived') return false;
      if (c.assigned_agent_id !== currentUserId) return false;
    }

    // 2. Lifecycle Filter
    if (lifecycleFilter !== 'all') {
      if (c.lifecycle_status !== lifecycleFilter) return false;
    }

    // 3. Search Filter (includes custom fields)
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match = 
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone_raw && c.phone_raw.includes(q)) ||
        (c.phone_normalized && c.phone_normalized.includes(q)) ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.course_interest && c.course_interest.toLowerCase().includes(q)) ||
        c.tags.some(t => t.toLowerCase().includes(q)) ||
        (c.custom_fields && Object.values(c.custom_fields).some(v => String(v).toLowerCase().includes(q)));
      if (!match) return false;
    }

    return true;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignContact) return;

    setReassignLoading(true);
    try {
      const res = await fetch(`/api/contacts/${reassignContact.id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: targetAgentId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setContacts(contacts.map(c => c.id === reassignContact.id ? { ...c, assigned_agent_id: targetAgentId || undefined } : c));
      setReassignModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setReassignLoading(false);
    }
  };

  const handleArchiveToggle = async (contact: Contact) => {
    if (!isOwner) return;
    const isCurrentlyArchived = contact.is_archived || contact.lifecycle_status === 'archived';
    const action = isCurrentlyArchived ? 'restore' : 'archive';

    try {
      const res = await fetch(`/api/contacts/${contact.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setContacts(contacts.map(c => c.id === contact.id ? data.contact : c));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMerge = async () => {
    if (!primaryId || !duplicateId) return;
    if (primaryId === duplicateId) {
      alert('Primary and duplicate contact cannot be the same record.');
      return;
    }

    setMergeLoading(true);
    try {
      const res = await fetch('/api/contacts/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryId, duplicateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to merge');

      alert('Contacts merged successfully.');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setMergeLoading(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Contact ID',
      'Full Name',
      'Email',
      'Phone',
      'Company',
      'City',
      'State/Postcode',
      'Course Interest',
      'Delivery Variant',
      'Assigned Advisor',
      'Lifecycle Status',
      'First Enquiry (Adelaide)',
      'Latest Enquiry (Adelaide)',
      ...tableCustomFields.map(f => f.label),
    ];

    const rows = filteredContacts.map(c => {
      const agent = profiles.find(p => p.id === c.assigned_agent_id);
      return [
        `"${c.id}"`,
        `"${c.full_name}"`,
        `"${c.email}"`,
        `"${c.phone_raw || ''}"`,
        `"${c.company || ''}"`,
        `"${c.city || ''}"`,
        `"${c.state_or_postcode || ''}"`,
        `"${c.course_interest || ''}"`,
        `"${c.delivery_variant || ''}"`,
        `"${agent?.full_name || 'Unassigned'}"`,
        `"${c.lifecycle_status}"`,
        `"${formatAdelaideDateTime(c.first_enquiry_at)}"`,
        `"${formatAdelaideDateTime(c.latest_enquiry_at)}"`,
        ...tableCustomFields.map(f => `"${c.custom_fields?.[f.field_key] || ''}"`),
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PTP_Contacts_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200 uppercase tracking-wider">
              {isOwner ? 'Organization-Wide Registry' : 'Personal Workspace'}
            </span>
            <span className="text-sm font-medium text-slate-500">
              ({filteredContacts.length} candidates visible)
            </span>
            {isOwner && (
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Full Owner Access &bull; Muhammad Jawad &amp; Sohail Sadiq
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {isOwner ? 'All Contacts & Students' : 'My Assigned Contacts'}
          </h1>
          <p className="text-base text-slate-600 mt-1 max-w-3xl">
            {isOwner 
              ? 'Complete organization directory. View and reassign candidates between Ayesha Sohail and Maryam Touqeer, manage unassigned enquiries, and inspect custom properties.'
              : 'Your assigned prospective students and qualification enquiries for Practical Training Pathways.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {isOwner && (
            <button
              onClick={() => setMergeModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[15px] font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm min-h-[44px]"
            >
              <GitMerge className="w-4 h-4 text-indigo-600" />
              <span>Merge Records</span>
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[15px] font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm min-h-[44px]"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <Link
            href="/test-capture"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-[#20409A] hover:bg-[#183279] text-white text-[15px] font-bold px-5 py-2.5 rounded-xl transition-all shadow min-h-[44px]"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Capture Enquiry</span>
          </Link>
        </div>
      </div>

      {/* OWNER LEAD VIEWS TABS (Section 1 Specification) */}
      {isOwner && (
        <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
          <button
            onClick={() => { setOwnerLeadView('all'); setAgentFilter('all'); }}
            className={`pb-3 px-3.5 font-bold text-[15px] transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              ownerLeadView === 'all'
                ? 'border-[#20409A] text-[#20409A]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>All Leads (Default)</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              ownerLeadView === 'all' ? 'bg-blue-100 text-[#20409A]' : 'bg-slate-100 text-slate-600'
            }`}>
              {countAll}
            </span>
          </button>

          <button
            onClick={() => { setOwnerLeadView('ayesha'); setAgentFilter('all'); }}
            className={`pb-3 px-3.5 font-bold text-[15px] transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              ownerLeadView === 'ayesha'
                ? 'border-[#20409A] text-[#20409A]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Ayesha&apos;s Leads</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              ownerLeadView === 'ayesha' ? 'bg-blue-100 text-[#20409A]' : 'bg-slate-100 text-slate-600'
            }`}>
              {countAyesha}
            </span>
          </button>

          <button
            onClick={() => { setOwnerLeadView('maryam'); setAgentFilter('all'); }}
            className={`pb-3 px-3.5 font-bold text-[15px] transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              ownerLeadView === 'maryam'
                ? 'border-[#20409A] text-[#20409A]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Maryam&apos;s Leads</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              ownerLeadView === 'maryam' ? 'bg-blue-100 text-[#20409A]' : 'bg-slate-100 text-slate-600'
            }`}>
              {countMaryam}
            </span>
          </button>

          <button
            onClick={() => { setOwnerLeadView('unassigned'); setAgentFilter('all'); }}
            className={`pb-3 px-3.5 font-bold text-[15px] transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              ownerLeadView === 'unassigned'
                ? 'border-[#20409A] text-[#20409A]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Unassigned Queue</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              countUnassigned > 0 
                ? 'bg-amber-100 text-amber-900 font-bold' 
                : 'bg-slate-100 text-slate-600'
            }`}>
              {countUnassigned}
            </span>
          </button>

          <button
            onClick={() => { setOwnerLeadView('archived'); setAgentFilter('all'); }}
            className={`pb-3 px-3.5 font-bold text-[15px] transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
              ownerLeadView === 'archived'
                ? 'border-[#20409A] text-[#20409A]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Archived Records</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              ownerLeadView === 'archived' ? 'bg-blue-100 text-[#20409A]' : 'bg-slate-100 text-slate-600'
            }`}>
              {countArchived}
            </span>
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidates by name, email, phone, city, course, or custom fields..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-11 pr-4 py-2.5 text-[16px] text-slate-900 font-medium focus:outline-none focus:border-[#20409A] transition-colors placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Lifecycle Filter */}
          <select
            value={lifecycleFilter}
            onChange={e => setLifecycleFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-[15px] font-semibold text-slate-800 focus:outline-none focus:border-[#20409A] min-h-[44px]"
          >
            <option value="all">All Stages</option>
            <option value="lead">New Leads</option>
            <option value="contact">Active Contacts</option>
            <option value="customer">Enrolled Students</option>
          </select>

          {/* Secondary Agent Selector Filter */}
          {isOwner && ownerLeadView === 'all' && (
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-[15px] font-semibold text-slate-800 focus:outline-none focus:border-[#20409A] min-h-[44px]"
            >
              <option value="all">Filter by Advisor...</option>
              <option value="unassigned">Unassigned Only</option>
              {profiles.filter(p => p.role === 'agent').map(agent => (
                <option key={agent.id} value={agent.id}>
                  Advisor: {agent.full_name}
                </option>
              ))}
            </select>
          )}

          {isOwner && (
            <Link
              href="/settings/modules-and-fields"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:text-blue-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap min-h-[44px]"
              title="Configure Table Columns & Custom Fields"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Configure Columns</span>
            </Link>
          )}
        </div>
      </div>

      {/* Contacts Table (Enterprise High-Contrast Layout, Responsive horizontal container) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px] border-collapse min-w-[1250px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[12px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 whitespace-nowrap min-w-[210px]">Candidate / Student</th>
                <th className="py-3.5 px-4 whitespace-nowrap min-w-[250px] max-w-[280px]">Contact Details</th>
                <th className="py-3.5 px-4 whitespace-nowrap min-w-[280px] max-w-[340px]">Course Interest</th>
                
                {/* Dynamically Rendered Configured Custom Fields */}
                {tableCustomFields.map(field => (
                  <th key={field.id} className="py-3.5 px-4 whitespace-nowrap">
                    {field.label}
                  </th>
                ))}

                <th className="py-3.5 px-4 whitespace-nowrap min-w-[180px]">Assigned Advisor</th>
                <th className="py-3.5 px-4 whitespace-nowrap min-w-[140px]">Stage</th>
                <th className="py-3.5 px-4 whitespace-nowrap min-w-[160px]">Latest Enquiry (Adelaide)</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap w-[110px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContacts.map(contact => {
                const agent = profiles.find(p => p.id === contact.assigned_agent_id);
                const isArchived = contact.is_archived || contact.lifecycle_status === 'archived';

                return (
                  <tr 
                    key={contact.id} 
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isArchived ? 'bg-slate-50/60 opacity-80' : ''
                    }`}
                  >
                    {/* Name & Badges */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/contacts/${contact.id}`} 
                          className="font-bold text-slate-900 hover:text-[#20409A] transition-colors text-[16px] whitespace-nowrap"
                        >
                          {contact.full_name}
                        </Link>
                        {contact.conflict_flag && (
                          <span 
                            title={contact.conflict_details}
                            className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase shrink-0"
                          >
                            Conflict
                          </span>
                        )}
                        {contact.course_review_required && (
                          <span 
                            title="Unrecognized course value entered review queue"
                            className="bg-purple-100 text-purple-800 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase shrink-0"
                          >
                            Review
                          </span>
                        )}
                        {isArchived && (
                          <span className="bg-slate-200 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase shrink-0">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] text-slate-500 mt-0.5 whitespace-nowrap">
                        {contact.company || 'Private Tradie / Individual'}
                      </div>
                    </td>

                    {/* Contact Details (Readable, Easy to Copy) */}
                    <td className="py-4 px-4 min-w-[250px] max-w-[280px]">
                      <div className="flex items-center gap-1.5 group/email">
                        <span 
                          className="font-mono text-slate-900 text-[14px] truncate font-medium select-all"
                          title={contact.email}
                        >
                          {contact.email}
                        </span>
                        <button
                          onClick={() => handleCopy(contact.email, `email_${contact.id}`)}
                          className="opacity-0 group-hover/email:opacity-100 p-1 text-slate-400 hover:text-slate-700 transition-opacity"
                          title="Copy Email"
                        >
                          {copiedId === `email_${contact.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {contact.phone_raw && (
                        <div className="text-[13px] text-slate-600 font-mono mt-1 flex items-center gap-1.5 whitespace-nowrap group/phone">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <a href={`tel:${contact.phone_raw || contact.phone_normalized}`} className="hover:text-[#20409A] transition-colors">
                            {formatAustralianPhone(contact.phone_raw || contact.phone_normalized)}
                          </a>
                          <button
                            onClick={() => handleCopy(contact.phone_raw || '', `phone_${contact.id}`)}
                            className="opacity-0 group-hover/phone:opacity-100 p-1 text-slate-400 hover:text-slate-700 transition-opacity"
                            title="Copy Phone"
                          >
                            {copiedId === `phone_${contact.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Course Interest */}
                    <td className="py-4 px-4 min-w-[280px] max-w-[340px]">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-[#20409A] border border-blue-200 shrink-0 font-mono">
                          {contact.course_interest?.includes('CPC50220') ? 'CPC50220' : 'CPC40120'}
                        </span>
                        <span 
                          className="font-semibold text-slate-900 text-[14px] truncate" 
                          title={contact.course_interest || 'Certificate IV in Building and Construction'}
                        >
                          {contact.course_interest?.replace(/^(CPC\d{5}\s*-\s*|CPC\d{5}\s*)/i, '') || 'Certificate IV in Building and Construction'}
                        </span>
                      </div>
                      <div className="text-[12px] text-slate-500 mt-1 flex items-center gap-1.5 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                        <span>{contact.delivery_variant || 'Self-Paced Online'}</span>
                        {contact.city && <span>&bull; {contact.city}</span>}
                      </div>
                    </td>

                    {/* Custom Properties Rendered in Table */}
                    {tableCustomFields.map(field => {
                      const val = contact.custom_fields?.[field.field_key];

                      let displayVal = '—';
                      if (val !== undefined && val !== null && val !== '') {
                        if (field.field_type === 'checkbox') {
                          displayVal = val ? 'Yes' : 'No';
                        } else if (Array.isArray(val)) {
                          displayVal = val.join(', ');
                        } else {
                          displayVal = String(val);
                        }
                      }

                      return (
                        <td key={field.id} className="py-4 px-4 text-slate-800 font-medium whitespace-nowrap">
                          {field.field_type === 'checkbox' ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              val ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {displayVal}
                            </span>
                          ) : field.field_type === 'single_select' && val ? (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                              {displayVal}
                            </span>
                          ) : (
                            displayVal
                          )}
                        </td>
                      );
                    })}

                    {/* Assigned Advisor Column with Owner Quick Reassign Option */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-2">
                        {agent ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#20409A] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                              {agent.full_name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 text-[14px] whitespace-nowrap">
                                {agent.full_name}
                              </div>
                              <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                                {agent.role === 'owner' ? 'Owner' : 'Calling Agent'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                            Unassigned
                          </span>
                        )}

                        {isOwner && (
                          <button
                            onClick={() => {
                              setReassignContact(contact);
                              setTargetAgentId(contact.assigned_agent_id || '');
                              setReassignModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors ml-1"
                            title="Reassign to another agent"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Stage */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                        contact.lifecycle_status === 'customer'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : contact.lifecycle_status === 'contact'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : contact.lifecycle_status === 'archived'
                          ? 'bg-slate-100 text-slate-600 border border-slate-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {contact.lifecycle_status}
                      </span>
                    </td>

                    {/* Latest Activity Timestamp */}
                    <td className="py-4 px-4 whitespace-nowrap font-mono text-[13px] text-slate-700">
                      <div className="font-medium text-slate-800 whitespace-nowrap">
                        {formatAdelaideDateTime(contact.latest_enquiry_at, 'dd MMM yyyy')}
                      </div>
                      <div className="text-[11px] text-slate-500 whitespace-nowrap">
                        {formatAdelaideDateTime(contact.latest_enquiry_at, 'hh:mm a')} ACDT
                      </div>
                    </td>

                    {/* Action Links */}
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="inline-flex items-center gap-1 bg-slate-100 hover:bg-[#20409A] hover:text-white text-slate-700 text-[13px] font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <span>Open</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>

                        {isOwner && (
                          <button
                            onClick={() => handleArchiveToggle(contact)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title={isArchived ? 'Restore Record' : 'Archive Record'}
                          >
                            {isArchived ? (
                              <RotateCcw className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Archive className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredContacts.length === 0 && (
                <tr>
                  <td colSpan={tableCustomFields.length + 6} className="text-center py-16 text-slate-400 text-[15px]">
                    No candidates found in this view matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK REASSIGN MODAL (Owner Only) */}
      {reassignModalOpen && reassignContact && (
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
              Select an advisor to assign <strong className="text-slate-900">{reassignContact.full_name}</strong> to. Associated pipeline opportunities and follow-up tasks will also be reassigned.
            </p>

            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Assign To:
                </label>
                <select
                  value={targetAgentId}
                  onChange={e => setTargetAgentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-[15px] font-medium text-slate-900 focus:outline-none focus:border-[#20409A]"
                >
                  <option value="">— Unassign (Move to Unassigned Queue) —</option>
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
                  {reassignLoading ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OWNER-ONLY CONTACT MERGE MODAL */}
      {mergeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GitMerge className="w-5 h-5 text-indigo-600" />
                <h3 className="text-[20px] font-bold text-slate-900">
                  Merge Duplicate Contacts
                </h3>
              </div>
              <p className="text-[14px] text-slate-600">
                Safely merge duplicate candidate records. All enquiries, notes, call logs, and tasks from the duplicate will be consolidated into the primary contact.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[14px] font-bold text-slate-800 mb-1.5">
                  Primary Contact (Record to Keep) *
                </label>
                <select
                  value={primaryId}
                  onChange={e => setPrimaryId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-[15px] text-slate-900 focus:outline-none focus:border-[#20409A]"
                >
                  <option value="">Select primary record...</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[14px] font-bold text-slate-800 mb-1.5">
                  Duplicate Contact (Record to Merge &amp; Remove) *
                </label>
                <select
                  value={duplicateId}
                  onChange={e => setDuplicateId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-[15px] text-slate-900 focus:outline-none focus:border-[#20409A]"
                >
                  <option value="">Select duplicate record to absorb...</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id} disabled={c.id === primaryId}>
                      {c.full_name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMergeModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 text-[14px] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMerge}
                disabled={mergeLoading || !primaryId || !duplicateId}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-[14px] transition-colors shadow-sm disabled:opacity-50"
              >
                {mergeLoading ? 'Merging...' : 'Confirm Consolidation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
