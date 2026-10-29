'use client';

import React, { useState } from 'react';
import { Organization } from '@/types/crm';
import { Settings, Save, CheckCircle2, ShieldCheck, Building, Mail, Clock, DollarSign } from 'lucide-react';

interface SettingsClientProps {
  organization: Organization;
}

export function SettingsClient({ organization: initialOrg }: SettingsClientProps) {
  const [org, setOrg] = useState<Organization>(initialOrg);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: org.name,
          website: org.website,
          default_timezone: org.default_timezone,
          default_currency: org.default_currency,
          email_sender_name: org.email_sender_name,
          email_sender_address: org.email_sender_address,
          reply_to_email: org.reply_to_email,
          auto_acknowledge_leads: org.auto_acknowledge_leads,
          notify_owners_new_lead: org.notify_owners_new_lead,
          notify_agents_new_lead: org.notify_agents_new_lead,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setOrg(data.organization);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 uppercase tracking-wider">
              Organization Controls
            </span>
            <span className="text-sm font-medium text-slate-500">• Owner Visibility Only</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Business Settings & Automation Rules
          </h1>
          <p className="text-base text-slate-600 mt-1">
            Configure RTO identity, display timezone (Australia/Adelaide), currency (AUD), and lead assignment rules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/settings/modules-and-fields"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-blue-50 hover:bg-blue-100 text-[#20409A] border border-blue-200 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-[#20409A]" /> Modules &amp; Fields Builder &rarr;
          </Link>
          {success && (
            <span className="text-sm text-emerald-800 font-semibold flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Settings Saved!
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business Identity Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building className="w-4 h-4 text-blue-700" /> RTO Business Identity & Localization
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Business / RTO Name</label>
              <input
                type="text"
                value={org.name}
                onChange={e => setOrg({ ...org, name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Website URL</label>
              <input
                type="text"
                value={org.website || ''}
                onChange={e => setOrg({ ...org, website: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Display Timezone</label>
              <input
                type="text"
                value={org.default_timezone}
                onChange={e => setOrg({ ...org, default_timezone: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500 mt-1 block">Default: Australia/Adelaide (ACST/ACDT DST)</span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Default Currency</label>
              <input
                type="text"
                value={org.default_currency}
                onChange={e => setOrg({ ...org, default_currency: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500 mt-1 block">Default: AUD (Australian Dollar)</span>
            </div>
          </div>
        </div>

        {/* Transactional Email Sender Identity */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2 pb-3 border-b border-slate-100">
            <Mail className="w-4 h-4 text-blue-700" /> Transactional Email Identity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm">
            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Sender Name</label>
              <input
                type="text"
                value={org.email_sender_name}
                onChange={e => setOrg({ ...org, email_sender_name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Sender Email Address</label>
              <input
                type="email"
                value={org.email_sender_address}
                onChange={e => setOrg({ ...org, email_sender_address: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Reply-To Address</label>
              <input
                type="email"
                value={org.reply_to_email}
                onChange={e => setOrg({ ...org, reply_to_email: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Lead Automation & Notification Preferences */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2 pb-3 border-b border-slate-100">
            <Settings className="w-4 h-4 text-blue-700" /> Student Lead Assignment & Notification Automation
          </h3>

          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <div className="font-bold text-slate-900">Auto-Acknowledge New Enquiries</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Instantly dispatch thank you email confirmation upon eligible website / Meta / Google enquiry submissions.
                </div>
              </div>
              <input
                type="checkbox"
                checked={org.auto_acknowledge_leads}
                onChange={e => setOrg({ ...org, auto_acknowledge_leads: e.target.checked })}
                className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <div className="font-bold text-slate-900">Notify Calling Agents on Lead Assignment</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Send immediate in-app and email alert to assigned calling agent (Ayesha or Maryam).
                </div>
              </div>
              <input
                type="checkbox"
                checked={org.notify_agents_new_lead}
                onChange={e => setOrg({ ...org, notify_agents_new_lead: e.target.checked })}
                className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <div className="font-bold text-slate-900">Notify Owners on New Enquiries</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Send notification alert to Muhammad Jawad & Sohail Sadiq for new high-priority building course enquiries.
                </div>
              </div>
              <input
                type="checkbox"
                checked={org.notify_owners_new_lead}
                onChange={e => setOrg({ ...org, notify_owners_new_lead: e.target.checked })}
                className="w-5 h-5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Organization Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
