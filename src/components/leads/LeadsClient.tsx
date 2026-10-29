'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { LeadSubmission, Contact, Profile, Role, FieldDefinition } from '@/types/crm';
import { formatAdelaideDateTime } from '@/lib/utils/date';
import { formatAustralianPhone } from '@/lib/utils/normalization';
import { 
  Inbox, 
  ExternalLink, 
  Search, 
  Filter, 
  Download, 
  BookOpen, 
  Building2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  UserCheck, 
  Copy, 
  Check, 
  Eye, 
  X, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  User,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';

interface EnrichedSubmission extends LeadSubmission {
  contact?: Contact;
  assignedAgentName?: string;
}

interface LeadsClientProps {
  initialSubmissions: LeadSubmission[];
  contacts: Contact[];
  profiles: Profile[];
  currentUserRole: Role;
  currentUserId: string;
  fieldDefs?: FieldDefinition[];
}

export function LeadsClient({
  initialSubmissions,
  contacts,
  profiles,
  currentUserRole,
  currentUserId,
  fieldDefs = [],
}: LeadsClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'test'>('all');
  
  // Specification Owner Lead Views:
  // 'all' (default), 'ayesha', 'maryam', 'unassigned', 'archived'
  const [ownerLeadView, setOwnerLeadView] = useState<'all' | 'ayesha' | 'maryam' | 'unassigned' | 'archived'>('all');

  // Quick detail modal state
  const [inspectSubmission, setInspectSubmission] = useState<EnrichedSubmission | null>(null);

  // Quick copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const isOwner = currentUserRole === 'owner';

  // Identify profiles for Ayesha & Maryam
  const ayeshaProfile = profiles.find(p => p.email.toLowerCase().includes('ayesha') || p.full_name.toLowerCase().includes('ayesha'));
  const maryamProfile = profiles.find(p => p.email.toLowerCase().includes('maryam') || p.full_name.toLowerCase().includes('maryam'));

  // Build contact lookup map
  const contactMap = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach(c => map.set(c.id, c));
    return map;
  }, [contacts]);

  // Enrich submissions with contact info & assigned agent
  const enrichedSubmissions = useMemo<EnrichedSubmission[]>(() => {
    return initialSubmissions.map(sub => {
      const contact = contactMap.get(sub.contact_id);
      let agentName = 'Unassigned';
      if (contact?.assigned_agent_id) {
        const agent = profiles.find(p => p.id === contact.assigned_agent_id);
        agentName = agent ? agent.full_name : 'Assigned Advisor';
      }
      return {
        ...sub,
        contact,
        assignedAgentName: agentName
      };
    });
  }, [initialSubmissions, contactMap, profiles]);

  // Compute counts for Owner Lead Views
  const viewCounts = useMemo(() => {
    let all = 0;
    let ayesha = 0;
    let maryam = 0;
    let unassigned = 0;
    let archived = 0;

    enrichedSubmissions.forEach(sub => {
      const contact = sub.contact;
      const isArch = sub.is_archived || contact?.is_archived || contact?.lifecycle_status === 'archived';

      if (isArch) {
        archived++;
      } else {
        all++;
        if (!contact?.assigned_agent_id) {
          unassigned++;
        } else if (ayeshaProfile && contact.assigned_agent_id === ayeshaProfile.id) {
          ayesha++;
        } else if (maryamProfile && contact.assigned_agent_id === maryamProfile.id) {
          maryam++;
        }
      }
    });

    return { all, ayesha, maryam, unassigned, archived };
  }, [enrichedSubmissions, ayeshaProfile, maryamProfile]);

  // Filter submissions
  const filteredSubmissions = useMemo(() => {
    return enrichedSubmissions.filter(sub => {
      const contact = sub.contact;
      const isArch = sub.is_archived || contact?.is_archived || contact?.lifecycle_status === 'archived';

      // 1. Role & Owner Lead Views Filter
      if (isOwner) {
        if (ownerLeadView === 'archived') {
          if (!isArch) return false;
        } else {
          if (isArch) return false;

          if (ownerLeadView === 'ayesha' && ayeshaProfile) {
            if (contact?.assigned_agent_id !== ayeshaProfile.id) return false;
          } else if (ownerLeadView === 'maryam' && maryamProfile) {
            if (contact?.assigned_agent_id !== maryamProfile.id) return false;
          } else if (ownerLeadView === 'unassigned') {
            if (contact?.assigned_agent_id) return false;
          }
        }

        // Secondary agent dropdown filter
        if (agentFilter !== 'all') {
          if (agentFilter === 'unassigned') {
            if (contact?.assigned_agent_id) return false;
          } else {
            if (contact?.assigned_agent_id !== agentFilter) return false;
          }
        }
      } else {
        // Calling Agent Isolation: never see archived, only see assigned
        if (isArch) return false;
        if (contact?.assigned_agent_id !== currentUserId) return false;
      }

      // 2. Channel filter
      if (channelFilter !== 'all' && sub.capture_channel !== channelFilter) {
        return false;
      }

      // 3. Status filter
      if (statusFilter === 'live' && sub.is_test) return false;
      if (statusFilter === 'test' && !sub.is_test) return false;

      // 4. Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const contactMatch = 
          contact?.full_name.toLowerCase().includes(q) ||
          contact?.email.toLowerCase().includes(q) ||
          contact?.phone_raw.toLowerCase().includes(q);
        
        const subMatch = 
          (sub.course_interest && sub.course_interest.toLowerCase().includes(q)) ||
          (sub.campaign_name && sub.campaign_name.toLowerCase().includes(q)) ||
          (sub.marketing_source && sub.marketing_source.toLowerCase().includes(q)) ||
          (sub.gclid && sub.gclid.toLowerCase().includes(q)) ||
          (sub.fbclid && sub.fbclid.toLowerCase().includes(q)) ||
          (sub.form_id && sub.form_id.toLowerCase().includes(q));

        // Custom fields search
        const customFieldsMatch = sub.custom_fields && Object.values(sub.custom_fields).some(
          val => String(val).toLowerCase().includes(q)
        );

        if (!contactMatch && !subMatch && !customFieldsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [
    enrichedSubmissions, 
    isOwner, 
    ownerLeadView, 
    agentFilter, 
    channelFilter, 
    statusFilter, 
    searchTerm, 
    ayeshaProfile, 
    maryamProfile, 
    currentUserId
  ]);

  // Paginated records
  const totalPages = Math.ceil(filteredSubmissions.length / pageSize) || 1;
  const paginatedSubmissions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSubmissions.slice(start, start + pageSize);
  }, [filteredSubmissions, currentPage, pageSize]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Submission ID',
      'Student Name',
      'Email',
      'Phone',
      'Course Interest',
      'Delivery Variant',
      'Channel',
      'Marketing Source',
      'Campaign Name',
      'Form ID',
      'GCLID',
      'FBCLID',
      'Assigned Advisor',
      'Adelaide Timestamp',
      'Status'
    ];

    const rows = filteredSubmissions.map(s => [
      `"${s.id}"`,
      `"${s.contact?.full_name || ''}"`,
      `"${s.contact?.email || ''}"`,
      `"${s.contact?.phone_raw || ''}"`,
      `"${s.course_interest || ''}"`,
      `"${s.delivery_variant || ''}"`,
      `"${s.capture_channel}"`,
      `"${s.marketing_source}"`,
      `"${s.campaign_name || ''}"`,
      `"${s.form_id || ''}"`,
      `"${s.gclid || ''}"`,
      `"${s.fbclid || ''}"`,
      `"${s.assignedAgentName || 'Unassigned'}"`,
      `"${formatAdelaideDateTime(s.submission_timestamp)}"`,
      `"${s.is_test ? 'Test' : 'Live'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PTP_Leads_Stream_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 uppercase tracking-wider inline-flex items-center gap-1.5">
              <Inbox className="w-3.5 h-3.5 text-blue-600" />
              Enquiry Ingestion Stream
            </span>
            <span className="text-sm font-semibold text-slate-500">
              {filteredSubmissions.length} of {initialSubmissions.length} touchpoints
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Leads &amp; Multi-Channel Touchpoints
          </h1>
          <p className="text-[16px] text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Real-time enquiry stream from WordPress Elementor forms, Meta instant forms, and 3CX calls. Every submission is immutable and linked to its student contact.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[15px] font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors min-h-[44px]"
            title="Export filtered enquiries to CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <Link
            href="/test-capture"
            className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-[15px] font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-colors min-h-[44px]"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Ingestion Simulator &rarr;</span>
          </Link>
        </div>
      </div>

      {/* Specification Owner Lead Views Tabs */}
      {isOwner && (
        <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 flex flex-wrap gap-1.5 text-[15px]">
          <button
            onClick={() => { setOwnerLeadView('all'); setCurrentPage(1); }}
            className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
              ownerLeadView === 'all'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span>All Enquiries</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              ownerLeadView === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
            }`}>
              {viewCounts.all}
            </span>
          </button>

          {ayeshaProfile && (
            <button
              onClick={() => { setOwnerLeadView('ayesha'); setCurrentPage(1); }}
              className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                ownerLeadView === 'ayesha'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span>Ayesha&apos;s Enquiries</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                ownerLeadView === 'ayesha' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {viewCounts.ayesha}
              </span>
            </button>
          )}

          {maryamProfile && (
            <button
              onClick={() => { setOwnerLeadView('maryam'); setCurrentPage(1); }}
              className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                ownerLeadView === 'maryam'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span>Maryam&apos;s Enquiries</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                ownerLeadView === 'maryam' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {viewCounts.maryam}
              </span>
            </button>
          )}

          <button
            onClick={() => { setOwnerLeadView('unassigned'); setCurrentPage(1); }}
            className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
              ownerLeadView === 'unassigned'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span>Unassigned</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              ownerLeadView === 'unassigned' ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'
            }`}>
              {viewCounts.unassigned}
            </span>
          </button>

          <button
            onClick={() => { setOwnerLeadView('archived'); setCurrentPage(1); }}
            className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
              ownerLeadView === 'archived'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span>Archived</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              ownerLeadView === 'archived' ? 'bg-slate-300 text-slate-800' : 'bg-slate-200 text-slate-700'
            }`}>
              {viewCounts.archived}
            </span>
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search student, email, phone, course, campaign, or GCLID..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 text-[15px] bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Channel Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={channelFilter}
              onChange={(e) => { setChannelFilter(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-[14px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Channels</option>
              <option value="website">Website (Elementor)</option>
              <option value="meta_ads">Meta Ads</option>
              <option value="google_ads">Google Ads</option>
              <option value="phone">3CX / Phone</option>
              <option value="manual">Manual Entry</option>
            </select>
          </div>

          {/* Owner Agent Filter */}
          {isOwner && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <UserCheck className="w-4 h-4 text-slate-400" />
              <select
                value={agentFilter}
                onChange={(e) => { setAgentFilter(e.target.value); setCurrentPage(1); }}
                className="bg-transparent text-[14px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Advisors</option>
                {ayeshaProfile && <option value={ayeshaProfile.id}>Ayesha Sohail</option>}
                {maryamProfile && <option value={maryamProfile.id}>Maryam Touqeer</option>}
                <option value="unassigned">Unassigned Only</option>
              </select>
            </div>
          )}

          {/* Test / Live Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
              className="bg-transparent text-[14px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="live">Live Students</option>
              <option value="test">Test Submissions</option>
            </select>
          </div>
        </div>
      </div>

      {/* Submissions Table with Horizontal Scroll Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px] min-w-[1250px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[12px]">
              <tr>
                <th className="py-3.5 px-5 whitespace-nowrap min-w-[240px]">Student / Contact</th>
                <th className="py-3.5 px-5 whitespace-nowrap min-w-[280px]">Course Interest</th>
                <th className="py-3.5 px-5 whitespace-nowrap min-w-[170px]">Assigned Advisor</th>
                <th className="py-3.5 px-5 whitespace-nowrap min-w-[150px]">Channel</th>
                <th className="py-3.5 px-5 whitespace-nowrap min-w-[220px]">Attribution / Campaign</th>
                <th className="py-3.5 px-5 whitespace-nowrap min-w-[130px]">Status</th>
                <th className="py-3.5 px-5 whitespace-nowrap min-w-[190px]">Adelaide Timestamp</th>
                <th className="py-3.5 px-5 text-right whitespace-nowrap w-[130px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedSubmissions.map(sub => {
                const contact = sub.contact;

                return (
                  <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Student / Contact Details */}
                    <td className="py-4 px-5">
                      {contact ? (
                        <div>
                          <Link 
                            href={`/contacts/${contact.id}`} 
                            className="font-bold text-slate-900 hover:text-blue-700 transition-colors inline-flex items-center gap-1.5 text-[16px]"
                          >
                            <span>{contact.full_name}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                          </Link>
                          <div className="flex items-center gap-3 mt-1 text-[13px] text-slate-500 font-mono">
                            <span 
                              onClick={() => handleCopy(contact.email, `em_${sub.id}`)}
                              className="hover:text-blue-600 cursor-pointer inline-flex items-center gap-1"
                              title="Click to copy email"
                            >
                              {copiedId === `em_${sub.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                              <span>{contact.email}</span>
                            </span>
                            {contact.phone_raw && (
                              <span 
                                onClick={() => handleCopy(contact.phone_raw, `ph_${sub.id}`)}
                                className="hover:text-blue-600 cursor-pointer inline-flex items-center gap-1"
                                title="Click to copy phone"
                              >
                                {copiedId === `ph_${sub.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                                <span>{formatAustralianPhone(contact.phone_raw)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="font-bold text-slate-500 italic text-[16px]">Unknown Contact</span>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">ID: {sub.contact_id}</div>
                        </div>
                      )}
                    </td>

                    {/* Course Interest */}
                    <td className="py-4 px-5">
                      {sub.course_interest ? (
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[13px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                            <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate max-w-[260px]">{sub.course_interest}</span>
                          </div>
                          {sub.delivery_variant && (
                            <div className="text-[13px] text-slate-600 font-medium mt-1">
                              {sub.delivery_variant}
                            </div>
                          )}
                        </div>
                      ) : sub.course_review_required ? (
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            Review Required
                          </span>
                          {sub.unrecognized_course_name && (
                            <div className="text-xs text-amber-800 font-mono mt-1">
                              &ldquo;{sub.unrecognized_course_name}&rdquo;
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[14px] text-slate-400 italic">General Enquiry</span>
                      )}
                    </td>

                    {/* Assigned Advisor */}
                    <td className="py-4 px-5">
                      {contact?.assigned_agent_id ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl text-[14px] font-semibold bg-slate-100 text-slate-800 border border-slate-200/80">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span>{sub.assignedAgentName}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[13px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Capture Channel */}
                    <td className="py-4 px-5">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider inline-block ${
                        sub.capture_channel === 'website' 
                          ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                          : sub.capture_channel === 'meta_ads'
                          ? 'bg-purple-50 text-purple-800 border border-purple-200'
                          : sub.capture_channel === 'google_ads'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {sub.capture_channel.replace('_', ' ')}
                      </span>
                      {sub.form_id && (
                        <div className="text-[12px] text-slate-500 font-mono mt-1 truncate max-w-[140px]" title={sub.form_id}>
                          {sub.form_id}
                        </div>
                      )}
                    </td>

                    {/* Marketing Attribution & Campaign */}
                    <td className="py-4 px-5 text-slate-700">
                      <div className="font-bold text-slate-900 capitalize text-[15px]">
                        {sub.marketing_source}
                      </div>
                      {sub.campaign_name ? (
                        <div className="text-[13px] text-slate-600 truncate max-w-[210px] mt-0.5 font-medium" title={sub.campaign_name}>
                          {sub.campaign_name}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Direct / Organic</span>
                      )}

                      {sub.gclid && (
                        <div 
                          onClick={() => handleCopy(sub.gclid!, `gcl_${sub.id}`)}
                          className="text-[11px] font-mono text-amber-800 truncate max-w-[190px] mt-0.5 cursor-pointer hover:underline"
                          title={`Click to copy GCLID: ${sub.gclid}`}
                        >
                          gclid: {sub.gclid}
                        </div>
                      )}
                      {sub.fbclid && (
                        <div 
                          onClick={() => handleCopy(sub.fbclid!, `fbc_${sub.id}`)}
                          className="text-[11px] font-mono text-purple-800 truncate max-w-[190px] mt-0.5 cursor-pointer hover:underline"
                          title={`Click to copy FBCLID: ${sub.fbclid}`}
                        >
                          fbclid: {sub.fbclid}
                        </div>
                      )}
                    </td>

                    {/* Test Lead Status */}
                    <td className="py-4 px-5">
                      {sub.is_test ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          Test Enquiry
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Live Student
                        </span>
                      )}
                    </td>

                    {/* Submission Timestamp (Australia/Adelaide) */}
                    <td className="py-4 px-5 text-slate-600 font-mono text-[13px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatAdelaideDateTime(sub.submission_timestamp)}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setInspectSubmission(sub)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Inspect full submission payload & metadata"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {contact && (
                          <Link
                            href={`/contacts/${contact.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[13px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedSubmissions.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500 text-[15px]">
                    <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No lead touchpoints match your criteria.</p>
                    <p className="text-sm text-slate-500 mt-1">Try clearing your search query or selecting a different channel filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredSubmissions.length > pageSize && (
          <div className="px-5 py-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600">
            <div>
              Showing <span className="font-bold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-slate-900">
                {Math.min(currentPage * pageSize, filteredSubmissions.length)}
              </span>{' '}
              of <span className="font-bold text-slate-900">{filteredSubmissions.length}</span> enquiries
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              <span className="px-3 font-semibold text-slate-900">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Submission Modal */}
      {inspectSubmission && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Touchpoint Details</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {inspectSubmission.id}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectSubmission(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-[15px]">
              {/* Linked Contact */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Linked Student Record</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {inspectSubmission.contact?.full_name || 'Unknown Contact'}
                  </div>
                  <div className="text-sm text-slate-600 font-mono">
                    {inspectSubmission.contact?.email} &bull; {inspectSubmission.contact?.phone_raw}
                  </div>
                </div>
                {inspectSubmission.contact && (
                  <Link
                    href={`/contacts/${inspectSubmission.contact.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    <span>View Contact</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {/* Course & Attribution Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Course Interest</div>
                  <div className="font-bold text-slate-900 mt-1">
                    {inspectSubmission.course_interest || 'General Enquiry'}
                  </div>
                  {inspectSubmission.delivery_variant && (
                    <div className="text-xs text-slate-500 mt-0.5">{inspectSubmission.delivery_variant}</div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned Advisor</div>
                  <div className="font-bold text-slate-900 mt-1">
                    {inspectSubmission.assignedAgentName || 'Unassigned'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Equal 50/50 round-robin logic</div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Marketing Channel</div>
                  <div className="font-bold text-slate-900 mt-1 capitalize">
                    {inspectSubmission.capture_channel.replace('_', ' ')}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Form: {inspectSubmission.form_id}</div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Submission Time (Adelaide)</div>
                  <div className="font-bold text-slate-900 mt-1 text-sm font-mono">
                    {formatAdelaideDateTime(inspectSubmission.submission_timestamp)}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Australia/Adelaide (UTC+9:30/10:30)</div>
                </div>
              </div>

              {/* Custom Fields (if any) */}
              {inspectSubmission.custom_fields && Object.keys(inspectSubmission.custom_fields).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ingested Custom Fields</h4>
                  <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200/60 divide-y divide-blue-100">
                    {Object.entries(inspectSubmission.custom_fields).map(([k, v]) => (
                      <div key={k} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-sm">
                        <span className="font-bold text-slate-700 font-mono text-xs">{k}</span>
                        <span className="font-semibold text-slate-900">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw Form Payload */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Raw Submission Payload</h4>
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-56">
                  {JSON.stringify(inspectSubmission.submission_data, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setInspectSubmission(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 font-bold text-slate-800 text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
