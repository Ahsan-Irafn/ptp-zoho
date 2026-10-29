'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Deal, DealStage, Contact, Profile } from '@/types/crm';
import { formatAdelaideDate } from '@/lib/utils/date';
import { 
  GraduationCap, 
  Calendar, 
  User, 
  Plus, 
  LayoutGrid, 
  List, 
  Search,
  Filter,
  UserCheck,
  X,
  Phone, 
  BookOpen, 
  ExternalLink,
  Clock, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

interface DealsClientProps {
  initialDeals: Deal[];
  contacts: Contact[];
  profiles: Profile[];
  currentUser: Profile;
}

const STAGES: { key: DealStage; label: string; bg: string; border: string; text: string }[] = [
  { key: 'new_enquiry', label: 'New Enquiry', bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800' },
  { key: 'assigned', label: 'Assigned', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900' },
  { key: 'contact_attempted', label: 'Contact Attempted', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900' },
  { key: 'contacted', label: 'Contacted', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-900' },
  { key: 'course_discussion', label: 'Course Discussion', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900' },
  { key: 'eligibility_review', label: 'Eligibility Review', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900' },
  { key: 'application_started', label: 'Application Started', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-900' },
  { key: 'documents_pending', label: 'Documents Pending', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900' },
  { key: 'enrolled', label: 'Enrolled', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900' },
  { key: 'not_proceeding', label: 'Not Proceeding', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900' },
];

export function DealsClient({
  initialDeals,
  contacts,
  profiles,
  currentUser,
}: DealsClientProps) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isOwner = currentUser.role === 'owner';

  // Identify Ayesha & Maryam
  const ayeshaProfile = profiles.find(p => p.email.toLowerCase().includes('ayesha') || p.full_name.toLowerCase().includes('ayesha'));
  const maryamProfile = profiles.find(p => p.email.toLowerCase().includes('maryam') || p.full_name.toLowerCase().includes('maryam'));

  const handleStageChange = async (dealId: string, newStage: DealStage) => {
    setUpdatingId(dealId);
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage } : d));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter deals
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      // Agent filter for owners
      if (isOwner && agentFilter !== 'all') {
        if (agentFilter === 'unassigned') {
          if (deal.assigned_agent_id) return false;
        } else {
          if (deal.assigned_agent_id !== agentFilter) return false;
        }
      }

      // Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const contact = contacts.find(c => c.id === deal.contact_id);
        const matchTitle = deal.title?.toLowerCase().includes(q);
        const matchCourse = deal.course_title?.toLowerCase().includes(q) || deal.course_code?.toLowerCase().includes(q);
        const matchContact = contact?.full_name.toLowerCase().includes(q) || contact?.email.toLowerCase().includes(q);
        const matchNotes = deal.notes?.toLowerCase().includes(q);

        if (!matchTitle && !matchCourse && !matchContact && !matchNotes) {
          return false;
        }
      }

      return true;
    });
  }, [deals, isOwner, agentFilter, searchTerm, contacts]);

  const activeEnquiries = filteredDeals.filter(d => d.stage !== 'not_proceeding' && d.stage !== 'enrolled').length;
  const enrolledTotal = filteredDeals.filter(d => d.stage === 'enrolled').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Progression Total */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[13px] font-bold text-[#20409A] uppercase tracking-wide bg-blue-50 px-3 py-1 rounded-full border border-blue-200 inline-flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              Building &amp; Construction Progression
            </span>
            <span className="text-[14px] text-slate-500 font-semibold">&bull; CPC40120 &amp; CPC50220</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Course Enquiry Pipeline
          </h1>
          <p className="text-[16px] text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Track student qualification progression through verification, eligibility assessment, and enrolment.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-white border border-slate-200 px-4 py-2 rounded-2xl text-[15px] shadow-sm flex items-center gap-4">
            <div>
              <span className="text-slate-500 font-medium">In Progress: </span>
              <strong className="text-[#20409A] font-bold font-mono text-[17px]">{activeEnquiries}</strong>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-slate-500 font-medium">Enrolled: </span>
              <strong className="text-emerald-700 font-bold font-mono text-[17px]">{enrolledTotal}</strong>
            </div>
          </div>

          <div className="flex bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-xl text-[14px] font-semibold transition-all ${
                viewMode === 'kanban' ? 'bg-[#20409A] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Kanban Board View"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-xl text-[14px] font-semibold transition-all ${
                viewMode === 'table' ? 'bg-[#20409A] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Search & Agent Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search student, qualification, course code, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-[15px] bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-slate-400"
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

        {isOwner && (
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <UserCheck className="w-4 h-4 text-slate-400" />
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="bg-transparent text-[14px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Advisors</option>
              {ayeshaProfile && <option value={ayeshaProfile.id}>Ayesha Sohail</option>}
              {maryamProfile && <option value={maryamProfile.id}>Maryam Touqeer</option>}
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
        )}
      </div>

      {/* Kanban Board View */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-6">
          <div className="flex gap-4 min-w-[2500px]">
            {STAGES.map(stage => {
              const stageDeals = filteredDeals.filter(d => d.stage === stage.key);

              return (
                <div key={stage.key} className="w-[285px] flex-shrink-0 flex flex-col bg-slate-100/70 border border-slate-200 rounded-2xl p-4">
                  {/* Stage Header */}
                  <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-200">
                    <span className="text-[15px] font-bold text-slate-900">
                      {stage.label}
                    </span>
                    <span className="text-[12px] bg-white border border-slate-200 font-bold font-mono text-slate-700 px-2 py-0.5 rounded-full">
                      {stageDeals.length}
                    </span>
                  </div>

                  {/* Deals in Stage */}
                  <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)]">
                    {stageDeals.map(deal => {
                      const contact = contacts.find(c => c.id === deal.contact_id);
                      const agent = profiles.find(p => p.id === deal.assigned_agent_id);

                      return (
                        <div
                          key={deal.id}
                          className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow space-y-3"
                        >
                          <div>
                            <Link
                              href={`/contacts/${deal.contact_id}`}
                              className="text-[16px] font-bold text-slate-900 hover:text-[#20409A] transition-colors leading-snug block"
                            >
                              {contact?.full_name || deal.title}
                            </Link>

                            {contact?.phone_raw && (
                              <div className="text-[13px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <a href={`tel:${contact.phone_raw}`} className="hover:text-[#20409A]">
                                  {contact.phone_raw}
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Course & Delivery Variant Badges */}
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-[#20409A] text-[12px] font-bold">
                              <BookOpen className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[200px]">{deal.course_code || 'CPC40120'}</span>
                            </div>
                            <div className="text-[13px] text-slate-600 font-medium pl-1">
                              {deal.delivery_variant || 'Self-Paced Online'}
                            </div>
                          </div>

                          {deal.notes && (
                            <p className="text-[13px] text-slate-600 line-clamp-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              {deal.notes}
                            </p>
                          )}

                          {/* Card Footer: Agent & Stage Mover */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[13px]">
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-semibold truncate max-w-[95px]">
                                {agent ? agent.full_name.split(' ')[0] : 'Unassigned'}
                              </span>
                            </div>

                            <select
                              value={deal.stage}
                              onChange={e => handleStageChange(deal.id, e.target.value as DealStage)}
                              disabled={updatingId === deal.id}
                              className="bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-700 py-1 px-1.5 focus:border-[#20409A] focus:outline-none cursor-pointer"
                            >
                              {STAGES.map(s => (
                                <option key={s.key} value={s.key}>
                                  &rarr; {s.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}

                    {stageDeals.length === 0 && (
                      <div className="p-6 text-center text-[13px] text-slate-400 border border-dashed border-slate-300 rounded-xl bg-white/40">
                        No enquiries
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[15px] min-w-[1100px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[12px] uppercase tracking-wider font-bold">
                  <th className="py-3.5 px-5 whitespace-nowrap min-w-[220px]">Student Contact</th>
                  <th className="py-3.5 px-5 whitespace-nowrap min-w-[280px]">Course &amp; Qualification</th>
                  <th className="py-3.5 px-5 whitespace-nowrap min-w-[200px]">Delivery Variant</th>
                  <th className="py-3.5 px-5 whitespace-nowrap min-w-[180px]">Pipeline Stage</th>
                  <th className="py-3.5 px-5 whitespace-nowrap min-w-[180px]">Assigned Advisor</th>
                  <th className="py-3.5 px-5 whitespace-nowrap min-w-[140px]">Date Logged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDeals.map(deal => {
                  const contact = contacts.find(c => c.id === deal.contact_id);
                  const agent = profiles.find(p => p.id === deal.assigned_agent_id);

                  return (
                    <tr key={deal.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-5 whitespace-nowrap">
                        <Link
                          href={`/contacts/${deal.contact_id}`}
                          className="font-bold text-slate-900 hover:text-[#20409A] text-[16px] whitespace-nowrap flex items-center gap-1.5"
                        >
                          <span>{contact?.full_name || deal.title}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        </Link>
                        {contact?.phone_raw && (
                          <div className="text-[13px] text-slate-500 font-mono mt-0.5 whitespace-nowrap">
                            {contact.phone_raw}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-5 min-w-[280px]">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded text-xs font-bold bg-blue-50 text-[#20409A] border border-blue-200 shrink-0 font-mono">
                            {deal.course_code || 'CPC40120'}
                          </span>
                          <span className="font-semibold text-slate-900 text-[15px] truncate max-w-[220px]" title={deal.course_title}>
                            {deal.course_title?.replace(/^(CPC\d{5}\s*-\s*|CPC\d{5}\s*)/i, '') || 'Certificate IV in Building'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-slate-700 whitespace-nowrap text-[15px]">
                        {deal.delivery_variant || 'Self-Paced Online'}
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap">
                        <select
                          value={deal.stage}
                          onChange={e => handleStageChange(deal.id, e.target.value as DealStage)}
                          disabled={updatingId === deal.id}
                          className="bg-white border border-slate-300 rounded-xl text-[14px] font-semibold text-slate-800 py-2 px-3 focus:border-[#20409A] focus:outline-none cursor-pointer shadow-sm"
                        >
                          {STAGES.map(s => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap">
                        {agent ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl text-[14px] font-semibold bg-slate-100 text-slate-800 border border-slate-200/80">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span>{agent.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-amber-800 bg-amber-50 border border-amber-200 text-xs px-2.5 py-1 rounded-lg font-bold">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-[14px] text-slate-600 font-mono whitespace-nowrap">
                        {formatAdelaideDate(deal.created_at)}
                      </td>
                    </tr>
                  );
                })}

                {filteredDeals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-[15px]">
                      No deals match the selected criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
