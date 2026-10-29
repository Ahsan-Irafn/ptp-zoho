'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Task, Contact, Profile, TaskPriority, TaskStatus } from '@/types/crm';
import { formatAdelaideDateTime } from '@/lib/utils/date';
import { 
  CheckSquare, 
  Clock, 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  Calendar, 
  User, 
  ExternalLink,
  Plus,
  Search,
  UserCheck,
  X
} from 'lucide-react';

interface TasksClientProps {
  initialTasks: Task[];
  contacts: Contact[];
  profiles: Profile[];
  currentUser: Profile;
}

export function TasksClient({
  initialTasks,
  contacts,
  profiles,
  currentUser,
}: TasksClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [agentFilter, setAgentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const now = new Date().toISOString();
  const isOwner = currentUser.role === 'owner';

  const ayeshaProfile = profiles.find(p => p.email.toLowerCase().includes('ayesha') || p.full_name.toLowerCase().includes('ayesha'));
  const maryamProfile = profiles.find(p => p.email.toLowerCase().includes('maryam') || p.full_name.toLowerCase().includes('maryam'));

  const handleToggleStatus = async (task: Task) => {
    setTogglingId(task.id);
    const nextStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTasks(prev => prev.map(t => t.id === task.id ? data.task : t));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTogglingId(null);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;

      if (isOwner && agentFilter !== 'all') {
        if (t.assigned_agent_id !== agentFilter) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const contact = contacts.find(c => c.id === t.contact_id);
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchContact = contact?.full_name.toLowerCase().includes(q);

        if (!matchTitle && !matchDesc && !matchContact) return false;
      }

      return true;
    });
  }, [tasks, statusFilter, isOwner, agentFilter, searchTerm, contacts]);

  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const overdueCount = tasks.filter(t => t.status === 'pending' && t.due_date < now).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 uppercase tracking-wider inline-flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" />
              Calling Agent Follow-ups
            </span>
            <span className="text-sm font-semibold text-slate-500">• Australia/Adelaide Timezone (ACST/ACDT)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Follow-up Schedule
          </h1>
          <p className="text-[16px] text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Scheduled student callbacks and course consultation tasks for Ayesha and Maryam.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2 rounded-2xl text-[15px] shadow-sm">
            <span className="text-slate-600 font-medium">Pending:</span>
            <strong className="text-slate-900 font-mono text-[17px]">{pendingCount}</strong>
            {overdueCount > 0 && (
              <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs bg-rose-50 text-rose-800 border border-rose-200 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                {overdueCount} Overdue
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-[14px]">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-2 font-bold rounded-xl transition-all ${
              statusFilter === 'pending' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-4 py-2 font-bold rounded-xl transition-all ${
              statusFilter === 'completed' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 font-bold rounded-xl transition-all ${
              statusFilter === 'all' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Tasks
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[14px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {isOwner && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[14px]">
              <UserCheck className="w-4 h-4 text-slate-400" />
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Advisors</option>
                {ayeshaProfile && <option value={ayeshaProfile.id}>Ayesha Sohail</option>}
                {maryamProfile && <option value={maryamProfile.id}>Maryam Touqeer</option>}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm overflow-hidden">
        {filteredTasks.map(task => {
          const contact = contacts.find(c => c.id === task.contact_id);
          const agent = profiles.find(p => p.id === task.assigned_agent_id);
          const isOverdue = task.status === 'pending' && task.due_date < now;

          return (
            <div
              key={task.id}
              className="p-5 flex items-start gap-4 hover:bg-slate-50/80 transition-colors"
            >
              {/* Checkbox Button */}
              <button
                disabled={togglingId === task.id}
                onClick={() => handleToggleStatus(task)}
                className="mt-1 text-slate-400 hover:text-blue-700 transition-colors flex-shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer"
                title={task.status === 'completed' ? 'Mark Pending' : 'Mark Completed'}
              >
                {task.status === 'completed' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                ) : (
                  <Circle className="w-6 h-6 text-slate-400 hover:text-blue-600" />
                )}
              </button>

              {/* Task Details */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className={`text-[16px] font-bold ${
                    task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'
                  }`}>
                    {task.title}
                  </span>

                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                    task.priority === 'urgent' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                    task.priority === 'high' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {task.priority}
                  </span>

                  {isOverdue && (
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                      OVERDUE
                    </span>
                  )}
                </div>

                {task.description && (
                  <p className="text-[15px] text-slate-600 mb-3">{task.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-[13px] text-slate-500">
                  <span className="flex items-center gap-1.5 font-mono text-slate-700 font-semibold bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Due: {formatAdelaideDateTime(task.due_date)}
                  </span>

                  {contact && (
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="text-slate-700 hover:text-blue-700 font-medium inline-flex items-center gap-1.5"
                    >
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{contact.full_name}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </Link>
                  )}

                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-slate-400">Assignee:</span>
                    <strong className="text-slate-900 font-semibold">{agent?.full_name || 'Agent'}</strong>
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && (
          <div className="py-20 text-center text-slate-500 text-[15px]">
            No tasks found in this view.
          </div>
        )}
      </div>
    </div>
  );
}
