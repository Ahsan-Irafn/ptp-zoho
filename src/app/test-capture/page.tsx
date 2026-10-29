'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function TestCapturePage() {
  const [activeTab, setActiveTab] = useState<'website' | 'meta' | 'google' | 'worker'>('website');
  const [responseOutput, setResponseOutput] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Website Form State
  const [webData, setWebData] = useState({
    fullName: 'Liam O’Connor',
    email: 'liam.oconnor@example.com.au',
    phone: '0412 345 678',
    company: 'Apex Builders Pty Ltd',
    city: 'Adelaide',
    state_or_postcode: 'SA 5000',
    course_interest: 'CPC40120 Certificate IV in Building and Construction (Building)',
    delivery_variant: 'Self-Paced Online',
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'adelaide_building_licence_pathway',
    gclid: 'gclid_ptp_simulation_99182',
    landing_page: 'https://www.pracpathways.com.au/cpc40120-certificate-iv-in-building-and-construction-building/',
    message: 'Looking to get my builder licence in South Australia. Please call me.',
  });

  // Meta Lead State
  const [metaData, setMetaData] = useState({
    leadgen_id: `meta_lead_${Date.now()}`,
    form_id: 'meta_form_cpc50220_diploma',
    campaign_name: 'Meta Ads Q4 Instagram Building Diploma',
    full_name: 'Chloe Nguyen',
    email: 'chloe.nguyen@example.com.au',
    phone_number: '0423 456 789',
    course_interest: 'CPC50220 Diploma of Building and Construction (Building)',
    delivery_variant: 'Blended',
    is_test: false,
  });

  // Google Native State
  const [googleData, setGoogleData] = useState({
    google_key: 'google_lead_secret_key_pracpathways_2026',
    lead_id: `google_lead_${Date.now()}`,
    form_id: 'google_form_cpc40120',
    campaign_id: 'camp_google_search_construction_cert_iv',
    full_name: 'Jack Davies',
    email: 'jack.davies@example.com.au',
    phone_number: '0434 567 890',
    company_name: 'Davies Carpentry & Framing',
    is_test: false,
  });

  const runWebsiteTest = async () => {
    setLoading(true);
    setResponseOutput(null);
    try {
      const res = await fetch('/api/webhooks/website-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webData),
      });
      const data = await res.json();
      setResponseOutput({ status: res.status, ok: res.ok, body: data });
    } catch (err: any) {
      setResponseOutput({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const runMetaTest = async () => {
    setLoading(true);
    setResponseOutput(null);
    try {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page_ptp_official',
            time: Math.floor(Date.now() / 1000),
            changes: [
              {
                field: 'leadgen',
                value: {
                  leadgen_id: metaData.leadgen_id,
                  form_id: metaData.form_id,
                  campaign_name: metaData.campaign_name,
                  full_name: metaData.full_name,
                  email: metaData.email,
                  phone_number: metaData.phone_number,
                  course_interest: metaData.course_interest,
                  delivery_variant: metaData.delivery_variant,
                  is_test: metaData.is_test,
                },
              },
            ],
          },
        ],
      };

      const res = await fetch('/api/webhooks/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResponseOutput({ status: res.status, ok: res.ok, body: data });
    } catch (err: any) {
      setResponseOutput({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const runGoogleTest = async () => {
    setLoading(true);
    setResponseOutput(null);
    try {
      const payload = {
        google_key: googleData.google_key,
        lead_id: googleData.lead_id,
        form_id: googleData.form_id,
        campaign_id: googleData.campaign_id,
        is_test: googleData.is_test,
        user_column_data: [
          { column_name: 'FULL_NAME', string_value: googleData.full_name },
          { column_name: 'EMAIL', string_value: googleData.email },
          { column_name: 'PHONE_NUMBER', string_value: googleData.phone_number },
          { column_name: 'COMPANY_NAME', string_value: googleData.company_name },
          { column_name: 'COURSE_INTEREST', string_value: 'CPC40120' },
        ],
      };

      const res = await fetch('/api/webhooks/google-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResponseOutput({ status: res.status, ok: res.ok, body: data });
    } catch (err: any) {
      setResponseOutput({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const triggerWorkerTick = async () => {
    setLoading(true);
    setResponseOutput(null);
    try {
      const res = await fetch('/api/cron/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setResponseOutput({ status: res.status, ok: res.ok, body: data });
    } catch (err: any) {
      setResponseOutput({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 sm:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-slate-200 gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 uppercase tracking-wider">
                Integration Verification Hub
              </span>
              <span className="text-sm font-medium text-slate-500">&bull; Australia/Adelaide Timezone (ACST/ACDT)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Live Ingestion &amp; Webhook Simulator</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Test Website, Meta Ads, and Google Ads student enquiries with 50/50 round-robin rotation between Ayesha and Maryam.
            </p>
          </div>
          <div className="w-full sm:w-auto shrink-0">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-[#20409A] hover:bg-[#1a3480] text-white text-[15px] font-bold px-5 py-2.5 sm:py-3 rounded-xl transition-colors shadow-sm min-h-[44px] w-full sm:w-auto"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap' }}
            >
              <span>&larr; Open CRM Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Channel Selector Tabs */}
        <div className="flex flex-wrap gap-2 bg-slate-200/70 p-1.5 rounded-xl border border-slate-300">
          <button
            onClick={() => setActiveTab('website')}
            className={`flex-1 min-h-[44px] py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'website' ? 'bg-white text-blue-950 shadow-sm border border-slate-200' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            🌐 Website Form (CPC40120)
          </button>
          <button
            onClick={() => setActiveTab('meta')}
            className={`flex-1 min-h-[44px] py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'meta' ? 'bg-white text-purple-950 shadow-sm border border-slate-200' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            📱 Meta Lead Ads (CPC50220)
          </button>
          <button
            onClick={() => setActiveTab('google')}
            className={`flex-1 min-h-[44px] py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'google' ? 'bg-white text-amber-950 shadow-sm border border-slate-200' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            🔍 Google Native Lead Form
          </button>
          <button
            onClick={() => setActiveTab('worker')}
            className={`flex-1 min-h-[44px] py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'worker' ? 'bg-white text-rose-950 shadow-sm border border-slate-200' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            ⚙️ Trigger Background Worker
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            {activeTab === 'website' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wider">
                  Website Submission (with Google Ads attribution)
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Full Name</label>
                  <input
                    type="text"
                    value={webData.fullName}
                    onChange={e => setWebData({ ...webData, fullName: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={webData.email}
                      onChange={e => setWebData({ ...webData, email: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Australian Phone</label>
                    <input
                      type="text"
                      value={webData.phone}
                      onChange={e => setWebData({ ...webData, phone: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Course Interest</label>
                    <select
                      value={webData.course_interest}
                      onChange={e => setWebData({ ...webData, course_interest: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-medium"
                    >
                      <option value="CPC40120 Certificate IV in Building and Construction (Building)">CPC40120 Cert IV</option>
                      <option value="CPC50220 Diploma of Building and Construction (Building)">CPC50220 Diploma</option>
                      <option value="Unknown Custom Course">Unknown Course (Flag Review)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Variant</label>
                    <select
                      value={webData.delivery_variant}
                      onChange={e => setWebData({ ...webData, delivery_variant: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-medium"
                    >
                      <option value="Self-Paced Online">Self-Paced Online</option>
                      <option value="Blended">Blended</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={runWebsiteTest}
                  disabled={loading}
                  className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-sm mt-3 min-h-[44px] disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Post to /api/webhooks/website-lead'}
                </button>
              </div>
            )}

            {activeTab === 'meta' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-purple-900 uppercase tracking-wider">
                  Meta Lead Ads Webhook Payload (CPC50220)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Leadgen ID</label>
                    <input
                      type="text"
                      value={metaData.leadgen_id}
                      onChange={e => setMetaData({ ...metaData, leadgen_id: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Form ID</label>
                    <input
                      type="text"
                      value={metaData.form_id}
                      onChange={e => setMetaData({ ...metaData, form_id: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={metaData.full_name}
                    onChange={e => setMetaData({ ...metaData, full_name: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={metaData.email}
                      onChange={e => setMetaData({ ...metaData, email: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={metaData.phone_number}
                      onChange={e => setMetaData({ ...metaData, phone_number: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900"
                    />
                  </div>
                </div>
                <button
                  onClick={runMetaTest}
                  disabled={loading}
                  className="w-full bg-purple-900 hover:bg-purple-800 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-sm mt-3 min-h-[44px] disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Post to /api/webhooks/meta'}
                </button>
              </div>
            )}

            {activeTab === 'google' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider">
                  Google Native Lead Form (webhook schema)
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">google_key (Shared Secret)</label>
                  <input
                    type="text"
                    value={googleData.google_key}
                    onChange={e => setGoogleData({ ...googleData, google_key: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Lead ID (string)</label>
                    <input
                      type="text"
                      value={googleData.lead_id}
                      onChange={e => setGoogleData({ ...googleData, lead_id: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={googleData.full_name}
                      onChange={e => setGoogleData({ ...googleData, full_name: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={googleData.email}
                      onChange={e => setGoogleData({ ...googleData, email: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={googleData.phone_number}
                      onChange={e => setGoogleData({ ...googleData, phone_number: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900"
                    />
                  </div>
                </div>
                <button
                  onClick={runGoogleTest}
                  disabled={loading}
                  className="w-full bg-amber-800 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-sm mt-3 min-h-[44px] disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Post to /api/webhooks/google-ads'}
                </button>
              </div>
            )}

            {activeTab === 'worker' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-rose-900 uppercase tracking-wider">
                  Durable Background Worker Trigger
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Triggers an atomic worker tick on the durable <code className="text-blue-900 font-mono">job_queue</code> table.
                  Picks pending student email acknowledgements, agent alerts, and overdue callback tasks.
                </p>
                <button
                  onClick={triggerWorkerTick}
                  disabled={loading}
                  className="w-full bg-rose-700 hover:bg-rose-600 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-sm min-h-[44px] disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Run Worker Tick (/api/cron/worker)'}
                </button>
              </div>
            )}
          </div>

          {/* Response Inspector */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                API Response Output
              </h3>
              {responseOutput?.status && (
                <span
                  className={`px-2.5 py-1 rounded text-xs font-bold ${
                    responseOutput.status < 300
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  HTTP {responseOutput.status}
                </span>
              )}
            </div>

            <div className="flex-1 bg-slate-900 rounded-xl p-4 font-mono text-xs overflow-auto max-h-[350px] text-emerald-400">
              {responseOutput ? (
                <pre>{JSON.stringify(responseOutput, null, 2)}</pre>
              ) : (
                <div className="text-slate-500 italic flex items-center justify-center h-full">
                  Click a test button to trigger a live ingestion and view the response here.
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
              <span>View processed leads in real-time:</span>
              <Link href="/leads" className="text-blue-700 hover:underline font-semibold">
                Open Leads / Enquiries →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
