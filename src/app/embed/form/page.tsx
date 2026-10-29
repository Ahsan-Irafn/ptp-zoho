'use client';

import React, { useState } from 'react';

export default function EmbedFormPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    company: '',
    city: 'Adelaide',
    state_or_postcode: 'SA',
    courseInterest: 'CPC40120 Certificate IV in Building and Construction (Building)',
    deliveryVariant: 'Self-Paced Online',
    message: '',
    consent: true,
    website_hp: '', // Honeypot
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const res = await fetch('/api/webhooks/website-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          city: formData.city,
          state_or_postcode: formData.state_or_postcode,
          course_interest: formData.courseInterest,
          delivery_variant: formData.deliveryVariant,
          message: formData.message,
          website_hp: formData.website_hp,
          utm_source: searchParams.get('utm_source') || 'website_direct',
          utm_medium: searchParams.get('utm_medium') || 'web_form',
          utm_campaign: searchParams.get('utm_campaign') || undefined,
          gclid: searchParams.get('gclid') || undefined,
          fbclid: searchParams.get('fbclid') || undefined,
          landing_page: window.location.href,
          referrer: document.referrer || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit enquiry');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Error submitting form');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-8 text-center bg-slate-50 min-h-screen text-slate-900 flex items-center justify-center">
        <div className="bg-white border border-slate-200 p-8 rounded-2xl max-w-md w-full shadow-lg">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold border border-emerald-200">
            ✓
          </div>
          <h2 className="text-2xl font-extrabold mb-2 text-slate-900">Enquiry Received!</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Thank you for contacting Practical Training Pathways (RTO # 22256). A dedicated course advisor (Ayesha or Maryam) will reach out to discuss your builder licensing eligibility shortly.
          </p>
          <button 
            onClick={() => setSubmitted(false)}
            className="text-sm text-blue-700 hover:text-blue-900 font-semibold underline"
          >
            Submit Another Course Enquiry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 flex items-center justify-center">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-lg">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-12 h-12 rounded-xl bg-blue-900 flex items-center justify-center text-white font-black text-lg shadow-sm">
            PTP
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Practical Training Pathways</h1>
            <p className="text-xs font-semibold text-slate-500">RTO # 22256 • Building & Construction Course Enquiry</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot Field for anti-spam */}
          <div className="hidden" aria-hidden="true">
            <input 
              type="text" 
              name="website_hp" 
              value={formData.website_hp} 
              onChange={e => setFormData({ ...formData, website_hp: e.target.value })} 
              tabIndex={-1} 
              autoComplete="off" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Liam O’Connor"
              value={formData.fullName}
              onChange={e => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="liam.oconnor@example.com.au"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Australian Phone *
              </label>
              <input
                type="tel"
                required
                placeholder="0412 345 678"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                City / Location
              </label>
              <input
                type="text"
                placeholder="Adelaide / Melbourne / Sydney"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                State / Postcode
              </label>
              <input
                type="text"
                placeholder="SA 5000 / VIC 3000"
                value={formData.state_or_postcode}
                onChange={e => setFormData({ ...formData, state_or_postcode: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Course of Interest *
            </label>
            <select
              value={formData.courseInterest}
              onChange={e => setFormData({ ...formData, courseInterest: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="CPC40120 Certificate IV in Building and Construction (Building)">
                CPC40120 Certificate IV in Building and Construction (Building)
              </option>
              <option value="CPC50220 Diploma of Building and Construction (Building)">
                CPC50220 Diploma of Building and Construction (Building)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Preferred Delivery Mode
            </label>
            <select
              value={formData.deliveryVariant}
              onChange={e => setFormData({ ...formData, deliveryVariant: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="Self-Paced Online">Self-Paced Online (Australia-wide)</option>
              <option value="Blended">Blended (Adelaide Campus + Online)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Questions or Trade Background
            </label>
            <textarea
              rows={3}
              placeholder="Tell us about your trade experience or builder licence goals..."
              value={formData.message}
              onChange={e => setFormData({ ...formData, message: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              id="consent"
              checked={formData.consent}
              onChange={e => setFormData({ ...formData, consent: e.target.checked })}
              className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <label htmlFor="consent" className="text-xs text-slate-600 leading-relaxed">
              I agree to receive communications regarding my enquiry via email and phone call from Practical Training Pathways.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md disabled:opacity-50 mt-2 text-sm min-h-[44px]"
          >
            {loading ? 'Submitting to Admissions...' : 'Submit Course Enquiry'}
          </button>
        </form>
      </div>
    </div>
  );
}
