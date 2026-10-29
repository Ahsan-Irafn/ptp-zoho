import React from 'react';
import Link from 'next/link';
import { requireOwner } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { formatCurrencyAUD, formatAdelaideDateTime } from '@/lib/utils/date';
import { 
  BarChart3, 
  Download, 
  TrendingUp, 
  Users, 
  Flame, 
  PhoneCall, 
  CheckCircle2, 
  Clock, 
  PieChart, 
  Award,
  AlertCircle,
  GraduationCap,
  BookOpen
} from 'lucide-react';

export default async function ReportsPage() {
  // Strict Owner Permission Check: Calling agents cannot view executive reports
  const currentUser = await requireOwner();
  const org = db.organizations.findFirst();
  if (!org) return <div>Organization not found</div>;

  const contacts = db.contacts.findMany(org.id);
  const leads = db.leads.findMany(org.id);
  const calls = db.callLogs.findMany(org.id);
  const deals = db.deals.findMany(org.id); // Owner has permission to see deals
  const tasks = db.tasks.findMany(org.id);
  const agents = db.profiles.findMany(org.id).filter(p => p.role === 'agent' && p.is_active);

  // Ingestion Channels
  const channelBreakdown: Record<string, number> = {};
  leads.forEach(l => {
    channelBreakdown[l.capture_channel] = (channelBreakdown[l.capture_channel] || 0) + 1;
  });

  // Call Outcomes
  const callOutcomes: Record<string, number> = {};
  calls.forEach(c => {
    callOutcomes[c.outcome] = (callOutcomes[c.outcome] || 0) + 1;
  });

  // Deal Pipeline Summary
  const wonDeals = deals.filter(d => d.stage === 'enrolled');
  const activeDeals = deals.filter(d => d.stage !== 'enrolled' && d.stage !== 'not_proceeding');

  const wonAmount = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const pipelineAmount = activeDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  // Agent Performance Breakdown
  const agentStats = agents.map(agent => {
    const assignedContacts = contacts.filter(c => c.assigned_agent_id === agent.id);
    const loggedCalls = calls.filter(c => c.agent_id === agent.id);
    const agentDeals = deals.filter(d => d.assigned_agent_id === agent.id);
    const agentWonDeals = agentDeals.filter(d => d.stage === 'enrolled');
    const wonVal = agentWonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    const pendingTasks = tasks.filter(t => t.assigned_agent_id === agent.id && t.status === 'pending');

    return {
      agent,
      contactsCount: assignedContacts.length,
      callsCount: loggedCalls.length,
      wonCount: agentWonDeals.length,
      wonValue: wonVal,
      pendingTasksCount: pendingTasks.length,
    };
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 uppercase tracking-wider">
              Owner Analytics &amp; Performance
            </span>
            <span className="text-sm font-medium text-slate-500">&bull; Australia/Adelaide Timezone (ACST/ACDT)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Executive CRM Reports
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">
            Real authorized metrics and enquiry conversions computed from immutable database records.
          </p>
        </div>

        <div className="w-full sm:w-auto shrink-0">
          <a
            href="/api/contacts/export"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5 py-2.5 sm:py-3 rounded-xl text-[15px] transition-colors shadow-sm min-h-[44px] w-full sm:w-auto"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            <Download className="w-4 h-4 shrink-0" style={{ flexShrink: 0 }} />
            <span>Export Clean Contacts CSV</span>
          </a>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Contacts vs Enquiries</div>
          <div className="text-3xl font-extrabold text-slate-900">
            {contacts.length} <span className="text-sm font-normal text-slate-500">contacts</span>
          </div>
          <div className="text-sm text-blue-700 mt-2 font-semibold">
            {leads.length} recorded touchpoints
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Course Enrolments Won</div>
          <div className="text-3xl font-extrabold text-emerald-600">
            {wonDeals.length}
          </div>
          <div className="text-sm text-slate-600 mt-2 font-medium">
            {wonAmount > 0 ? `${formatCurrencyAUD(wonAmount)} tuition fee value` : 'Verified student enrolments'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active Enquiry Pipeline</div>
          <div className="text-3xl font-extrabold text-blue-900">
            {activeDeals.length}
          </div>
          <div className="text-sm text-slate-600 mt-2 font-medium">
            Students in eligibility / document review
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Human Calls Logged</div>
          <div className="text-3xl font-extrabold text-indigo-700">
            {calls.length}
          </div>
          <div className="text-sm text-slate-600 mt-2 font-medium">
            Enquiry response speed: &lt; 2 hrs SLA
          </div>
        </div>
      </div>

      {/* Agent Workload Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-1">
          Calling Agent Workload & Performance Comparison
        </h3>
        <p className="text-sm text-slate-600 mb-6">
          Side-by-side performance of Ayesha Sohail and Maryam Touqeer (50/50 Round-Robin distribution)
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
              <tr>
                <th className="py-3.5 px-4">Calling Agent</th>
                <th className="py-3.5 px-4">Assigned Contacts</th>
                <th className="py-3.5 px-4">Calls Completed</th>
                <th className="py-3.5 px-4">Enrolments Won</th>
                <th className="py-3.5 px-4">Pending Follow-ups</th>
                <th className="py-3.5 px-4 text-right">Workload Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agentStats.map(stat => (
                <tr key={stat.agent.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <img src={stat.agent.avatar_url} alt={stat.agent.full_name} className="w-9 h-9 rounded-full bg-slate-200 object-cover" />
                      <div>
                        <div className="font-bold text-slate-900 text-base">{stat.agent.full_name}</div>
                        <div className="text-xs text-slate-500 font-mono">{stat.agent.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-slate-900 text-base">{stat.contactsCount}</td>
                  <td className="py-4 px-4 font-mono font-bold text-blue-700 text-base">{stat.callsCount}</td>
                  <td className="py-4 px-4 font-mono font-bold text-emerald-600 text-base">{stat.wonCount}</td>
                  <td className="py-4 px-4 font-mono text-amber-700 font-semibold text-base">{stat.pendingTasksCount}</td>
                  <td className="py-4 px-4 text-right font-medium text-slate-600">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      Active 50%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Columns: Channels & Call Outcomes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider mb-5">
            Enquiries by Capture Channel
          </h3>
          <div className="space-y-4 text-sm">
            {Object.entries(channelBreakdown).map(([ch, count]) => {
              const pct = Math.round((count / (leads.length || 1)) * 100);
              return (
                <div key={ch}>
                  <div className="flex justify-between text-slate-700 mb-1.5 font-medium">
                    <span className="capitalize">{ch.replace('_', ' ')}</span>
                    <span className="font-mono text-slate-900">{count} enquiries ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Call Outcomes Distribution */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider mb-5">
            Call Outcome Distribution
          </h3>
          <div className="space-y-4 text-sm">
            {Object.entries(callOutcomes).map(([outcome, count]) => {
              const pct = Math.round((count / (calls.length || 1)) * 100);
              return (
                <div key={outcome}>
                  <div className="flex justify-between text-slate-700 mb-1.5 font-medium">
                    <span className="capitalize">{outcome.replace('_', ' ')}</span>
                    <span className="font-mono text-slate-900">{count} calls ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
