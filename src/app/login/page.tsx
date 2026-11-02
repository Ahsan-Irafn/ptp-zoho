'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, ShieldCheck, ArrowRight, AlertCircle, Building2, Eye, EyeOff, UserCheck } from 'lucide-react';

const TEAM_ACCOUNTS = [
  { name: 'Sohail Sadiq', role: 'Owner', email: 'sohail.sadiq@pracpathways.com.au', password: 'SohailPTP2026!' },
  { name: 'Muhammad Jawad', role: 'Owner', email: 'muhammad.jawad@pracpathways.com.au', password: 'JawadPTP2026!' },
  { name: 'Ayesha Sohail', role: 'Calling Agent', email: 'ayesha.sohail@pracpathways.com.au', password: 'AyeshaPTP2026!' },
  { name: 'Maryam Touqeer', role: 'Calling Agent', email: 'maryam.touqeer@pracpathways.com.au', password: 'MaryamPTP2026!' },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid email or password.');
      }

      router.push(redirectPath);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = (acc: typeof TEAM_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-8 sm:p-10 shadow-xl space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-[#20409A] text-white font-black text-2xl flex items-center justify-center mx-auto shadow-md shadow-blue-900/20">
            PTP
          </div>
          <h1 className="text-[28px] sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Practical Training Pathways
          </h1>
          <p className="text-[15px] text-slate-600 font-medium">
            Practical Training Pathways CRM &bull; RTO # 22256
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-[#20409A]">
            <Building2 className="w-3.5 h-3.5" />
            Adelaide, South Australia &bull; Australia/Adelaide Time
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-[15px] flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Authentication Failed</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        {/* Quick Select Authorized Account */}
        <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[#20409A]" />
              Quick Fill Authorized Team Account
            </span>
            <span className="text-[11px] text-slate-400">Click to autofill</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TEAM_ACCOUNTS.map(acc => {
              const isSelected = email.toLowerCase() === acc.email.toLowerCase();
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleSelectAccount(acc)}
                  className={`text-left p-2.5 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-50/80 border-[#20409A] shadow-sm ring-1 ring-[#20409A]'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                  }`}
                >
                  <span className="font-bold text-slate-800 truncate">{acc.name}</span>
                  <span className="text-[11px] text-[#20409A] font-semibold">{acc.role}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[16px] font-semibold text-slate-800 mb-1.5">
              Work Email Address
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="name@pracpathways.com.au"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-12 pr-4 py-3 text-[16px] text-slate-900 placeholder:text-slate-400 focus:border-[#20409A] focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[16px] font-semibold text-slate-800">
                Password
              </label>
              <Link 
                href="/invite" 
                className="text-[14px] text-[#20409A] hover:underline font-semibold"
              >
                Set up / reset password
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="Enter your individual password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-12 pr-12 py-3 text-[16px] text-slate-900 placeholder:text-slate-400 focus:border-[#20409A] focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] bg-[#20409A] hover:bg-[#1a3480] text-white font-bold py-3.5 px-5 rounded-xl transition-all shadow-md shadow-blue-900/20 disabled:opacity-50 text-[17px] flex items-center justify-center gap-2"
          >
            {loading ? 'Verifying Credentials...' : 'Sign In to Workspace'}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        {/* Security Notice */}
        <div className="pt-4 border-t border-slate-200 text-center space-y-2">
          <div className="text-[14px] text-slate-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Secure Role-Based Authentication &bull; MFA Prepared</span>
          </div>
          <p className="text-[13px] text-slate-400">
            Authorized personnel only. Sessions and audit events are monitored.
          </p>
        </div>

      </div>
    </div>
  );
}
