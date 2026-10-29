import React from 'react';
import { EmailService } from '@/lib/services/email-service';
import Link from 'next/link';

export default function UnsubscribePage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token;
  let result = { success: false, email: '' };

  if (token) {
    result = EmailService.handleUnsubscribe(token) as any;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-lg">
        <div className="w-16 h-16 bg-blue-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-5 text-xl font-black shadow-md">
          PTP
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Practical Training Pathways</h1>
        <div className="text-xs font-semibold text-slate-500 mb-6">RTO # 22256 • Student Communication Preferences</div>

        {result.success ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl text-sm mb-6 text-left">
            <p className="font-bold mb-1 text-emerald-800">Unsubscribe Successful</p>
            <p className="text-xs text-emerald-700 leading-relaxed">
              The email address <strong>{result.email}</strong> has been suppressed from automated course follow-up communications.
            </p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl text-sm mb-6 text-left">
            <p className="font-bold mb-1 text-amber-800">Invalid or Expired Link</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              This unsubscribe link is invalid or has expired. If you wish to opt out, please contact our student support team at <strong>info@pracpathways.com.au</strong> or call <strong>+61 8 6102 2094</strong>.
            </p>
          </div>
        )}

        <div className="text-xs text-slate-500 pt-4 border-t border-slate-100">
          Practical Training Pathways &copy; {new Date().getFullYear()} • Adelaide, South Australia
        </div>
      </div>
    </div>
  );
}
