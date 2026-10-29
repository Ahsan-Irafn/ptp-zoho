'use client';

import React, { useState } from 'react';
import { EmailMessage, EmailTemplate, SuppressionRecord, Profile } from '@/types/crm';
import { formatAdelaideDateTime } from '@/lib/utils/date';
import { 
  Mail, 
  Send, 
  FileText, 
  ShieldBan, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Eye, 
  Edit3,
  ExternalLink 
} from 'lucide-react';

interface EmailsClientProps {
  initialTemplates: EmailTemplate[];
  initialMessages: EmailMessage[];
  suppressions: SuppressionRecord[];
  currentUser: Profile;
}

export function EmailsClient({
  initialTemplates,
  initialMessages,
  suppressions,
  currentUser,
}: EmailsClientProps) {
  const [activeTab, setActiveTab] = useState<'templates' | 'outbox' | 'suppressions'>('templates');
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>(initialTemplates[0]);
  const [editSubject, setEditSubject] = useState(initialTemplates[0]?.subject || '');
  const [editHtml, setEditHtml] = useState(initialTemplates[0]?.body_html || '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const isOwner = currentUser.role === 'owner';

  const handleSelectTemplate = (tpl: EmailTemplate) => {
    setSelectedTemplate(tpl);
    setEditSubject(tpl.subject);
    setEditHtml(tpl.body_html);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

    setSaving(true);
    setSavedSuccess(false);
    try {
      const res = await fetch('/api/emails/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedTemplate.name,
          slug: selectedTemplate.slug,
          subject: editSubject,
          body_html: editHtml,
          body_text: editSubject,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTemplates(prev => prev.map(t => t.id === selectedTemplate.id ? data.template : t));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 uppercase tracking-wider">
              Enquiry Communications
            </span>
            <span className="text-sm font-medium text-slate-500">• Anti-Spam & Suppression Engine</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Email Activity & Approved Templates
          </h1>
          <p className="text-base text-slate-600 mt-1">
            Automated course acknowledgement and agent email communications in Australia/Adelaide time.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all min-h-[44px] ${
              activeTab === 'templates' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Approved Templates ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('outbox')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all min-h-[44px] ${
              activeTab === 'outbox' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Outbox Stream ({initialMessages.length})
          </button>
          <button
            onClick={() => setActiveTab('suppressions')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all min-h-[44px] ${
              activeTab === 'suppressions' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Suppression List ({suppressions.length})
          </button>
        </div>
      </div>

      {/* TAB 1: TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Template List */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 px-2">
              Select Template
            </h3>
            {templates.map(tpl => {
              const isSelected = selectedTemplate?.id === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`p-4 rounded-xl cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-blue-50/70 border border-blue-300 shadow-sm' 
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="font-bold text-sm text-slate-900">{tpl.name}</div>
                  <div className="text-xs text-blue-700 font-mono mt-0.5">{tpl.slug}</div>
                  <div className="text-xs text-slate-500 mt-1 truncate">{tpl.subject}</div>
                </div>
              );
            })}
          </div>

          {/* Template Editor / Preview */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            {selectedTemplate ? (
              <form onSubmit={handleSaveTemplate} className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selectedTemplate.name}</h2>
                    <p className="text-xs text-slate-500">Slug: <code className="text-blue-700 font-mono">{selectedTemplate.slug}</code></p>
                  </div>
                  {savedSuccess && (
                    <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Template Saved!
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    value={editSubject}
                    onChange={e => setEditSubject(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 disabled:opacity-60 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      HTML Email Body
                    </label>
                    <span className="text-xs text-slate-500 font-mono">
                      Available: {'{{contact.name}}, {{agent.name}}, {{unsubscribe_url}}'}
                    </span>
                  </div>
                  <textarea
                    rows={12}
                    disabled={!isOwner}
                    value={editHtml}
                    onChange={e => setEditHtml(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-4 text-sm text-slate-900 font-mono leading-relaxed disabled:opacity-60 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {isOwner ? (
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 min-h-[44px]"
                    >
                      {saving ? 'Saving...' : 'Save Template Changes'}
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-600 italic border border-slate-200">
                    Calling Agents can preview approved templates. Only owners can edit system templates.
                  </div>
                )}
              </form>
            ) : null}
          </div>
        </div>
      )}

      {/* TAB 2: OUTBOX STREAM */}
      {activeTab === 'outbox' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
                <tr>
                  <th className="py-3.5 px-4">Recipient</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Delivery Status</th>
                  <th className="py-3.5 px-4">Provider Message ID</th>
                  <th className="py-3.5 px-4">Sent At (Adelaide)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {initialMessages.map(msg => (
                  <tr key={msg.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-900">{msg.recipient_email}</td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">{msg.subject}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                        msg.status === 'delivered' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                        msg.status === 'queued' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        msg.status === 'suppressed' ? 'bg-slate-100 text-slate-700' :
                        'bg-rose-50 text-rose-800'
                      }`}>
                        {msg.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{msg.provider_message_id || '—'}</td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                      {formatAdelaideDateTime(msg.sent_at || msg.created_at)}
                    </td>
                  </tr>
                ))}

                {initialMessages.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-500 text-sm">
                      No emails dispatched yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SUPPRESSIONS */}
      {activeTab === 'suppressions' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-6">
          <div className="mb-5">
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider">
              Suppression & Opt-Out Records
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Addresses in this list are automatically excluded from automated course follow-up sequences.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
                <tr>
                  <th className="py-3.5 px-4">Identifier (Email / Phone)</th>
                  <th className="py-3.5 px-4">Suppression Reason</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4">Opted Out At (Adelaide)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppressions.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-900 font-medium">{s.email || s.phone}</td>
                    <td className="py-3.5 px-4 capitalize font-semibold text-rose-700">{s.reason}</td>
                    <td className="py-3.5 px-4 text-slate-600">{s.source || 'Manual DNC'}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 text-xs">
                      {formatAdelaideDateTime(s.created_at)}
                    </td>
                  </tr>
                ))}

                {suppressions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500 text-sm">
                      Zero suppressions recorded. Email reputation healthy.
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
