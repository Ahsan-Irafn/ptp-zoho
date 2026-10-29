'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Contact, CallOutcome } from '@/types/crm';
import { formatAdelaideDateTime, formatRelativeTime } from '@/lib/utils/date';
import { formatAustralianPhone } from '@/lib/utils/normalization';
import { 
  PhoneCall, 
  Phone, 
  Clock, 
  AlertCircle, 
  Calendar, 
  CheckCircle2, 
  Search, 
  User, 
  Flame, 
  ExternalLink,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Send,
  Building2
} from 'lucide-react';

export default function CallingWorkspacePage() {
  const [activeQueue, setActiveQueue] = useState<'new_leads' | 'today' | 'overdue' | 'no_answer' | 'callbacks'>('new_leads');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  // Call Logger State
  const [callDuration, setCallDuration] = useState(0);
  const [isCallingTimerRunning, setIsCallingTimerRunning] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome>('connected');
  const [callNotes, setCallNotes] = useState('');
  const [nextAction, setNextAction] = useState('Send course information pack and follow up');
  const [followUpDate, setFollowUpDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // Fetch permitted contacts for current user
  useEffect(() => {
    fetch('/api/calling/queue')
      .then(res => res.json())
      .then(data => {
        if (data.contacts) {
          setContacts(data.contacts);
          if (data.contacts.length > 0) {
            setSelectedContact(data.contacts[0]);
          }
        }
      })
      .catch(err => console.error('Failed to load queue:', err))
      .finally(() => setLoading(false));
  }, []);

  // Call duration counter
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCallingTimerRunning) {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isCallingTimerRunning]);

  const handleStartCall = () => {
    setIsCallingTimerRunning(true);
    setCallDuration(0);
  };

  const handleEndCall = () => {
    setIsCallingTimerRunning(false);
  };

  const handleSubmitCallLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/contacts/${selectedContact.id}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          duration_seconds: callDuration,
          notes: callNotes,
          next_action: nextAction,
          follow_up_date: followUpDate ? new Date(followUpDate).toISOString() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessToast(`Call outcome logged for ${selectedContact.full_name}`);
      setIsCallingTimerRunning(false);
      setCallDuration(0);
      setCallNotes('');
      setFollowUpDate('');

      // Auto-advance to next lead in queue
      const currentIndex = contacts.findIndex(c => c.id === selectedContact.id);
      if (currentIndex !== -1 && currentIndex < contacts.length - 1) {
        setSelectedContact(contacts[currentIndex + 1]);
      }

      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      alert(`Error logging call: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Queue filtering
  const now = new Date();
  const filteredContacts = contacts.filter(contact => {
    if (activeQueue === 'new_leads') return contact.lifecycle_status === 'lead';
    if (activeQueue === 'overdue') {
      return contact.next_follow_up_at && new Date(contact.next_follow_up_at) < now;
    }
    if (activeQueue === 'callbacks') {
      return !!contact.next_follow_up_at;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-bold text-[#20409A] uppercase tracking-wide bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              Orbitel-Style Dialler Workspace
            </span>
            <span className="text-[14px] text-slate-500 font-medium">&bull; Adelaide Local Operations</span>
          </div>
          <h1 className="text-[28px] sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Admissions Calling Workspace
          </h1>
          <p className="text-[16px] text-slate-600 mt-1">
            Streamlined outbound telephone queue for CPC40120 &amp; CPC50220 Building &amp; Construction enquiries.
          </p>
        </div>

        {/* Queue Metrics Pill */}
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-2xl text-[14px] shadow-sm flex items-center gap-3">
            <div>
              <span className="text-slate-500">In Queue: </span>
              <strong className="text-[#20409A] font-bold font-mono text-[16px]">{filteredContacts.length}</strong>
            </div>
            <div className="border-l border-slate-200 pl-3">
              <span className="text-slate-500">Overdue: </span>
              <strong className="text-rose-600 font-bold font-mono text-[16px]">
                {contacts.filter(c => c.next_follow_up_at && new Date(c.next_follow_up_at) < now).length}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {successToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-[15px] font-semibold flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Workspace Layout (5:7 Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Dialler Queue (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col space-y-4">
          {/* Queue Tab Buttons */}
          <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1">
            <button
              onClick={() => setActiveQueue('new_leads')}
              className={`flex-1 py-2 rounded-lg text-[14px] font-bold transition-all ${
                activeQueue === 'new_leads'
                  ? 'bg-white text-[#20409A] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              New Leads
            </button>
            <button
              onClick={() => setActiveQueue('overdue')}
              className={`flex-1 py-2 rounded-lg text-[14px] font-bold transition-all ${
                activeQueue === 'overdue'
                  ? 'bg-white text-rose-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overdue
            </button>
            <button
              onClick={() => setActiveQueue('callbacks')}
              className={`flex-1 py-2 rounded-lg text-[14px] font-bold transition-all ${
                activeQueue === 'callbacks'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Callbacks
            </button>
          </div>

          {/* Queue Contact Items */}
          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[calc(100vh-320px)] pr-1">
            {filteredContacts.map(contact => {
              const isSelected = selectedContact?.id === contact.id;
              const isOverdue = contact.next_follow_up_at && new Date(contact.next_follow_up_at) < now;

              return (
                <div
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50/70 border-[#20409A] shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[16px] font-bold text-slate-900 truncate">
                        {contact.full_name}
                      </div>
                      <div className="text-[14px] text-slate-600 font-mono mt-0.5">
                        {formatAustralianPhone(contact.phone_raw || contact.phone_normalized)}
                      </div>
                    </div>
                    {isOverdue && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[11px] font-extrabold rounded-md uppercase">
                        Overdue
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[13px] text-slate-500">
                    <span className="font-semibold text-[#20409A] truncate max-w-[180px]">
                      {contact.course_interest || 'CPC40120 Building'}
                    </span>
                    <span>{formatRelativeTime(contact.latest_enquiry_at)}</span>
                  </div>
                </div>
              );
            })}

            {filteredContacts.length === 0 && !loading && (
              <div className="text-center py-16 text-slate-400 text-[15px]">
                No leads in this queue. Great work!
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Candidate Dialler & Outcome Form (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm flex flex-col justify-between">
          {selectedContact ? (
            <div className="space-y-6">
              {/* Candidate Info Header */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[13px] text-slate-500 font-semibold uppercase tracking-wider mb-1">
                    Active Outbound Candidate
                  </div>
                  <h2 className="text-[22px] font-extrabold text-slate-900 flex items-center gap-3">
                    {selectedContact.full_name}
                    <Link 
                      href={`/contacts/${selectedContact.id}`}
                      className="text-[14px] text-[#20409A] hover:underline flex items-center gap-1 font-semibold"
                    >
                      Full Details <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </h2>
                  <div className="text-[14px] text-slate-600 mt-1 flex flex-wrap gap-4">
                    <span>Email: <strong className="text-slate-900 font-mono">{selectedContact.email}</strong></span>
                    <span>Location: <strong className="text-slate-900">{selectedContact.city || 'Adelaide'}, {selectedContact.country || 'Australia'}</strong></span>
                  </div>

                  {/* Course Details Pill */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-100 text-[#20409A] text-[13px] font-bold">
                      <BookOpen className="w-4 h-4" />
                      {selectedContact.course_interest || 'CPC40120 Certificate IV in Building and Construction'}
                    </span>
                    <span className="text-[13px] text-slate-600 font-medium">
                      ({selectedContact.delivery_variant || 'Self-Paced Online'})
                    </span>
                  </div>
                </div>

                {/* Live Call Duration / Dialer Button */}
                <div className="flex flex-col sm:items-end gap-3 shrink-0 w-full sm:w-auto">
                  {selectedContact.phone_raw && (
                    <a
                      href={`tel:${selectedContact.phone_raw}`}
                      onClick={handleStartCall}
                      className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-xl text-[15px] sm:text-[16px] transition-all shadow-md shadow-emerald-700/20 min-h-[46px] w-full sm:w-auto"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap' }}
                    >
                      <Phone className="w-5 h-5 shrink-0" style={{ flexShrink: 0 }} />
                      <span>Click-to-Call</span>
                    </a>
                  )}

                  <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-center min-w-[90px] shadow-sm">
                    <div className="text-[11px] text-slate-500 font-bold uppercase font-mono">Duration</div>
                    <div className={`text-[18px] font-bold font-mono ${isCallingTimerRunning ? 'text-[#20409A] animate-pulse' : 'text-slate-800'}`}>
                      {formatTimer(callDuration)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Call Outcome Logging Form */}
              <form onSubmit={handleSubmitCallLog} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Outcome Select */}
                  <div>
                    <label className="block text-[15px] font-bold text-slate-800 mb-1.5">
                      Call Outcome *
                    </label>
                    <select
                      value={outcome}
                      onChange={e => setOutcome(e.target.value as CallOutcome)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-[16px] text-slate-900 focus:border-[#20409A] focus:outline-none"
                    >
                      <option value="connected">Connected (Detailed Talk)</option>
                      <option value="interested">Interested (Lead Qualified)</option>
                      <option value="callback_requested">Callback Requested</option>
                      <option value="appointment_booked">Appointment / Assessment Booked</option>
                      <option value="no_answer">No Answer</option>
                      <option value="busy">Busy / Disconnected</option>
                      <option value="wrong_number">Wrong Number</option>
                      <option value="not_interested">Not Interested</option>
                      <option value="do_not_call">Do Not Call (Opt-Out)</option>
                    </select>
                  </div>

                  {/* Measured Duration */}
                  <div>
                    <label className="block text-[15px] font-bold text-slate-800 mb-1.5">
                      Duration (Seconds)
                    </label>
                    <input
                      type="number"
                      value={callDuration}
                      onChange={e => setCallDuration(parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-[16px] text-slate-900 focus:border-[#20409A] focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Next Action */}
                  <div>
                    <label className="block text-[15px] font-bold text-slate-800 mb-1.5">
                      Next Follow-up Action
                    </label>
                    <input
                      type="text"
                      value={nextAction}
                      onChange={e => setNextAction(e.target.value)}
                      placeholder="e.g. Email CPC40120 syllabus & checklist"
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-[16px] text-slate-900 focus:border-[#20409A] focus:outline-none"
                    />
                  </div>

                  {/* Follow-up Date/Time in Australia/Adelaide */}
                  <div>
                    <label className="block text-[15px] font-bold text-slate-800 mb-1.5">
                      Scheduled Follow-up Date (Adelaide Time)
                    </label>
                    <input
                      type="datetime-local"
                      value={followUpDate}
                      onChange={e => setFollowUpDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-[16px] text-slate-900 focus:border-[#20409A] focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Call Notes */}
                <div>
                  <label className="block text-[15px] font-bold text-slate-800 mb-1.5">
                    Admissions Call Notes &amp; Consultation Summary
                  </label>
                  <textarea
                    rows={3}
                    value={callNotes}
                    onChange={e => setCallNotes(e.target.value)}
                    placeholder="Candidate trade background, builder licence ambitions, preferred study variant (Self-paced online vs blended), questions raised..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-4 text-[16px] text-slate-900 focus:border-[#20409A] focus:outline-none"
                  />
                </div>

                {/* Submit Button */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleEndCall}
                    className="text-[14px] text-slate-500 hover:text-slate-800 font-semibold"
                  >
                    Reset Timer
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-[48px] bg-[#20409A] hover:bg-[#1a3480] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md shadow-blue-900/20 text-[16px] flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{submitting ? 'Saving Log...' : 'Save Call Log & Advance'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="text-center py-24 text-slate-400 text-[16px]">
              Select a candidate from the queue on the left to begin outbound calling.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
