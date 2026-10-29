import React from 'react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { formatAdelaideDateTime } from '@/lib/utils/date';
import { 
  Users, 
  Inbox, 
  PhoneCall, 
  CheckCircle2, 
  AlertTriangle, 
  GraduationCap, 
  Clock, 
  Flame, 
  ArrowRight,
  BookOpen,
  Building2,
  CalendarCheck
} from 'lucide-react';

export default async function DashboardPage() {
  const currentUser = await requireUser();
  const org = db.organizations.findFirst();
  if (!org) return <div>Organization not found</div>;

  const isOwner = currentUser.role === 'owner';

  // Real Database Queries with Data Access Layer Scoping
  const allContacts = db.contacts.findMany(org.id, isOwner ? undefined : { agentId: currentUser.id });
  const allLeads = db.leads.findMany(org.id);
  const allDeals = db.deals.findMany(org.id, isOwner ? undefined : { agentId: currentUser.id, role: currentUser.role });
  const allTasks = db.tasks.findMany(org.id, isOwner ? undefined : currentUser.id);
  const allCalls = db.callLogs.findMany(org.id, isOwner ? undefined : currentUser.id);
  const allCourses = db.courses.findMany(org.id, false);
  const teamMembers = db.profiles.findMany(org.id).filter(p => p.is_active);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Metrics (Education focused — No financial leakages)
  const totalContactsCount = allContacts.length;
  const totalEnquiriesCount = allLeads.length;
  const newLeadsToday = allContacts.filter(c => c.first_enquiry_at >= todayStart).length;

  const pendingTasks = allTasks.filter(t => t.status === 'pending');
  const overdueTasks = pendingTasks.filter(t => t.due_date < now.toISOString());

  const callsToday = allCalls.filter(c => c.timestamp >= todayStart);

  // Education Pipeline Breakdown
  const enrolledCount = allDeals.filter(d => d.stage === 'enrolled').length;
  const activeApplicationsCount = allDeals.filter(d => d.stage !== 'not_proceeding' && d.stage !== 'enrolled').length;

  // Channel Breakdown
  const channelCounts: Record<string, number> = {
    website: 0,
    meta_ads: 0,
    google_ads: 0,
    manual: 0,
  };
  allLeads.forEach(l => {
    if (channelCounts[l.capture_channel] !== undefined) {
      channelCounts[l.capture_channel]++;
    }
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-6 border-b border-slate-200">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-[13px] font-bold bg-blue-50 text-[#20409A] border border-blue-200 uppercase tracking-wider">
              {isOwner ? 'Executive Owner Command Center' : 'Admissions Calling Workspace'}
            </span>
            <span className="text-[14px] text-slate-500 font-medium">&bull; Practical Training Pathways</span>
          </div>
          <h1 className="text-[26px] sm:text-[32px] font-extrabold text-slate-900 tracking-tight leading-tight">
            Welcome back, {currentUser.full_name.split(' ')[0]}
          </h1>
          <p className="text-[15px] sm:text-[16px] text-slate-600 mt-1 max-w-3xl">
            {isOwner 
              ? 'Multi-channel oversight of building & construction enquiries, agent workload, course pipeline, and integration health.'
              : 'Your dedicated queue of assigned building course enquiries, callbacks, and admissions follow-ups.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
          <Link
            href="/calling"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-[#20409A] hover:bg-[#1a3480] text-white font-bold px-5 py-3 rounded-xl text-[15px] sm:text-[16px] transition-all shadow-md shadow-blue-900/20 min-h-[46px] w-full sm:w-auto"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            <PhoneCall className="w-5 h-5 shrink-0" style={{ flexShrink: 0 }} />
            <span>Open Calling Workspace</span>
          </Link>
          {isOwner && (
            <Link
              href="/reports"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-white hover:bg-slate-50 text-slate-800 font-semibold px-5 py-3 rounded-xl text-[15px] sm:text-[16px] border border-slate-300 transition-colors shadow-sm min-h-[46px] w-full sm:w-auto"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap' }}
            >
              <span>Executive Reports</span>
            </Link>
          )}
        </div>
      </div>

      {/* Top Key Metrics Cards (Clean White Theme & High Contrast) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[13px] font-bold uppercase tracking-wider text-slate-600">
              {isOwner ? 'Total Contacts' : 'My Assigned Contacts'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#20409A]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[34px] font-extrabold text-slate-900 mb-1">{totalContactsCount}</div>
          <div className="text-[14px] text-slate-500 flex items-center justify-between">
            <span>Enquiries Recorded:</span>
            <strong className="text-[#20409A] font-bold">{isOwner ? totalEnquiriesCount : allContacts.length}</strong>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[13px] font-bold uppercase tracking-wider text-slate-600">New Leads Today</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[34px] font-extrabold text-slate-900 mb-1">{newLeadsToday}</div>
          <div className="text-[14px] text-slate-500">
            Across Website, Meta &amp; Google native forms
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[13px] font-bold uppercase tracking-wider text-slate-600">
              {isOwner ? 'Overdue Follow-ups' : 'My Overdue Tasks'}
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              overdueTasks.length > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-[34px] font-extrabold mb-1 ${overdueTasks.length > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {overdueTasks.length}
          </div>
          <div className="text-[14px] text-slate-500 flex items-center justify-between">
            <span>Pending Callbacks:</span>
            <strong className="text-slate-800 font-bold">{pendingTasks.length}</strong>
          </div>
        </div>

        {/* Metric 4 (Replaced commercial Rs pipeline with Education Progression) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[13px] font-bold uppercase tracking-wider text-slate-600">Active Applications</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[34px] font-extrabold text-slate-900 mb-1">
            {activeApplicationsCount}
          </div>
          <div className="text-[14px] text-slate-500 flex items-center justify-between">
            <span>Confirmed Enrolments:</span>
            <strong className="text-emerald-700 font-bold font-mono">{enrolledCount} Students</strong>
          </div>
        </div>
      </div>

      {/* Owner Workload & Multi-Channel Breakdown (Owner Only) */}
      {isOwner && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Workload Card */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="text-[17px] font-bold text-slate-900 uppercase tracking-wide">
                  Calling Agent Workload &amp; Lead Rotation
                </h3>
                <p className="text-[14px] text-slate-500">
                  Strict 50/50 persistent round-robin distribution between Ayesha Sohail and Maryam Touqeer
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold font-mono self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Active Rotation
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {teamMembers.filter(m => m.role === 'agent').map(agent => {
                const agentContacts = allContacts.filter(c => c.assigned_agent_id === agent.id);
                const agentCalls = allCalls.filter(c => c.agent_id === agent.id);
                const agentTasks = allTasks.filter(t => t.assigned_agent_id === agent.id && t.status === 'pending');
                const agentOverdue = agentTasks.filter(t => t.due_date < now.toISOString());

                return (
                  <div key={agent.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-3.5 mb-4">
                      <img 
                        src={agent.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=PTP'} 
                        alt={agent.full_name} 
                        className="w-12 h-12 rounded-full bg-white border border-slate-300"
                      />
                      <div>
                        <div className="text-[16px] font-bold text-slate-900">{agent.full_name}</div>
                        <div className="text-[13px] text-[#20409A] font-semibold">{agent.email}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-slate-200 text-center">
                      <div className="p-3 rounded-xl bg-white border border-slate-200">
                        <div className="text-[12px] text-slate-500 font-semibold uppercase">Assigned</div>
                        <div className="text-[20px] font-extrabold text-slate-900 font-mono mt-0.5">{agentContacts.length}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200">
                        <div className="text-[12px] text-slate-500 font-semibold uppercase">Calls</div>
                        <div className="text-[20px] font-extrabold text-[#20409A] font-mono mt-0.5">{agentCalls.length}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200">
                        <div className="text-[12px] text-slate-500 font-semibold uppercase">Overdue</div>
                        <div className={`text-[20px] font-extrabold font-mono mt-0.5 ${agentOverdue.length > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                          {agentOverdue.length}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Capture Channel Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-[17px] font-bold text-slate-900 uppercase tracking-wide mb-1">
                Ingestion Touchpoints
              </h3>
              <p className="text-[14px] text-slate-500 mb-5">Verified capture channels</p>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-[15px] p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="flex items-center gap-2.5 text-slate-800 font-medium">
                    <span className="w-3 h-3 rounded-full bg-[#20409A]"></span>
                    Website Enquiries
                  </span>
                  <strong className="text-slate-900 font-bold font-mono">{channelCounts.website}</strong>
                </div>

                <div className="flex items-center justify-between text-[15px] p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="flex items-center gap-2.5 text-slate-800 font-medium">
                    <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
                    Meta Lead Ads (FB/IG)
                  </span>
                  <strong className="text-slate-900 font-bold font-mono">{channelCounts.meta_ads}</strong>
                </div>

                <div className="flex items-center justify-between text-[15px] p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="flex items-center gap-2.5 text-slate-800 font-medium">
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    Google Ads Native
                  </span>
                  <strong className="text-slate-900 font-bold font-mono">{channelCounts.google_ads}</strong>
                </div>

                <div className="flex items-center justify-between text-[15px] p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="flex items-center gap-2.5 text-slate-800 font-medium">
                    <span className="w-3 h-3 rounded-full bg-slate-500"></span>
                    Manual Entry / CSV
                  </span>
                  <strong className="text-slate-900 font-bold font-mono">{channelCounts.manual}</strong>
                </div>
              </div>
            </div>

            <div className="pt-5 border-t border-slate-200 mt-6">
              <Link 
                href="/integrations" 
                className="text-[15px] text-[#20409A] hover:underline font-bold flex items-center justify-between"
              >
                <span>Manage Connected Integrations</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity & Calling Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calling / Follow-up Action Queue */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-[17px] font-bold text-slate-900 uppercase tracking-wide">
                {isOwner ? 'Recent Scheduled Follow-ups' : 'My Next Scheduled Calls'}
              </h3>
              <p className="text-[14px] text-slate-500">Scheduled in Australia/Adelaide timezone</p>
            </div>
            <Link href="/calling" className="text-[14px] text-[#20409A] hover:underline font-bold">
              Calling Queue &rarr;
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {pendingTasks.slice(0, 5).map(task => (
              <div key={task.id} className="py-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-slate-900 truncate">{task.title}</div>
                  <div className="text-[14px] text-slate-600 truncate mt-0.5">{task.description}</div>
                  <div className="text-[13px] text-[#20409A] mt-1 flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Due: {formatAdelaideDateTime(task.due_date)}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[12px] font-bold uppercase ${
                  task.priority === 'urgent' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                  task.priority === 'high' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {task.priority}
                </span>
              </div>
            ))}

            {pendingTasks.length === 0 && (
              <div className="py-10 text-center text-[15px] text-slate-500">
                No pending follow-ups scheduled. All queues caught up!
              </div>
            )}
          </div>
        </div>

        {/* Recent Call Logs & Outcomes */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-[17px] font-bold text-slate-900 uppercase tracking-wide">
                Recent Logged Calls
              </h3>
              <p className="text-[14px] text-slate-500">Admissions call history &amp; outcomes</p>
            </div>
            <Link href="/contacts" className="text-[14px] text-[#20409A] hover:underline font-bold">
              All Contacts &rarr;
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {allCalls.slice(0, 5).map(call => {
              const contact = allContacts.find(c => c.id === call.contact_id);
              const agent = teamMembers.find(m => m.id === call.agent_id);
              return (
                <div key={call.id} className="py-3.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold text-slate-900">
                      {contact?.full_name || 'Contact'}
                    </div>
                    <div className="text-[14px] text-slate-600 truncate mt-0.5">
                      {call.notes || 'Call completed'}
                    </div>
                    <div className="text-[13px] text-slate-500 mt-1">
                      By {agent?.full_name.split(' ')[0] || 'Agent'} &bull; {formatAdelaideDateTime(call.timestamp)}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[12px] font-bold capitalize ${
                    call.outcome === 'connected' || call.outcome === 'interested' || call.outcome === 'appointment_booked'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : call.outcome === 'do_not_call'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {call.outcome.replace('_', ' ')}
                  </span>
                </div>
              );
            })}

            {allCalls.length === 0 && (
              <div className="py-10 text-center text-[15px] text-slate-500">
                No calls logged yet. Start from the Calling Workspace.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
