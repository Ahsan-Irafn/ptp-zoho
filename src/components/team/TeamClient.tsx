'use client';

import React, { useState } from 'react';
import { Profile, Invitation, Role } from '@/types/crm';
import { formatAdelaideDateTime } from '@/lib/utils/date';
import { 
  UserCheck, 
  UserPlus, 
  ShieldCheck, 
  Key, 
  Copy, 
  Check, 
  AlertCircle,
  ExternalLink 
} from 'lucide-react';

interface TeamClientProps {
  initialProfiles: Profile[];
  initialInvitations: Invitation[];
  appUrl: string;
}

export function TeamClient({
  initialProfiles,
  initialInvitations,
  appUrl,
}: TeamClientProps) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Invite Modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('agent');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('');

  const copyToClipboard = (text: string, token: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setGeneratedInviteUrl('');
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          fullName: inviteName,
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setProfiles([...profiles, data.profile]);
      setInvitations([...invitations, data.invitation]);
      setGeneratedInviteUrl(data.inviteUrl);
      setInviteEmail('');
      setInviteName('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 uppercase tracking-wider">
              Access &amp; Provisioning
            </span>
            <span className="text-sm font-medium text-slate-500">&bull; 4 Independent Accounts</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Team Members &amp; Secure Provisioning
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">
            Muhammad Jawad &amp; Sohail Sadiq hold individual owner credentials. Calling agents Ayesha &amp; Maryam receive scoped access with zero financial visibility.
          </p>
        </div>

        <div className="w-full sm:w-auto shrink-0">
          <button
            onClick={() => setInviteModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-[#20409A] hover:bg-[#1a3480] text-white font-bold px-5 py-2.5 sm:py-3 rounded-xl text-[15px] transition-colors shadow-sm min-h-[44px] w-full sm:w-auto"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            <UserPlus className="w-4 h-4 shrink-0" style={{ flexShrink: 0 }} />
            <span>Invite Team Member</span>
          </button>
        </div>
      </div>

      {/* Active Profiles Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Active User Accounts ({profiles.length})
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            Security Invariant: Last active owner cannot be disabled
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
              <tr>
                <th className="py-3.5 px-5">Member Name</th>
                <th className="py-3.5 px-5">Email Address</th>
                <th className="py-3.5 px-5">Role & Access Scope</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Setup Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map(member => {
                const invite = invitations.find(i => i.email.toLowerCase() === member.email.toLowerCase());
                const inviteUrl = invite ? `${appUrl}/invite?token=${invite.token}` : null;

                return (
                  <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <img src={member.avatar_url} alt={member.full_name} className="w-9 h-9 rounded-full bg-slate-200 object-cover" />
                        <div>
                          <div className="font-bold text-slate-900 text-base">{member.full_name}</div>
                          <div className="text-xs text-slate-500 font-mono">ID: {member.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5 font-mono text-slate-700 font-medium">
                      {member.email}
                    </td>
                    <td className="py-4 px-5">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        member.role === 'owner' 
                          ? 'bg-blue-50 text-blue-900 border border-blue-200' 
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}>
                        {member.role === 'owner' ? 'Business Owner' : 'Calling Agent (Financial Isolated)'}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Active
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      {inviteUrl ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Invite:</span>
                          <button
                            onClick={() => copyToClipboard(inviteUrl, invite!.token)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-mono flex items-center gap-1.5 transition-colors border border-slate-300"
                          >
                            {copiedToken === invite!.token ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-600" />
                                Copy Link
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs font-medium">Active Credentials</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-700" />
                Invite Team Member
              </h3>
              <button onClick={() => setInviteModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg p-1">✕</button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Smith"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="john.smith@pracpathways.com.au"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">System Role *</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as Role)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                >
                  <option value="agent">Calling Agent (Assigned contacts, calling workspace, follow-ups; NO financial access)</option>
                  <option value="owner">Business Owner (Full administrative access, team management, reports)</option>
                </select>
              </div>

              {generatedInviteUrl && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
                  <div className="font-bold">Setup Invitation Generated!</div>
                  <div className="text-xs break-all font-mono text-emerald-800">{generatedInviteUrl}</div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-900 font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-5 py-2.5 rounded-xl disabled:opacity-50 min-h-[44px]"
                >
                  {inviteLoading ? 'Generating...' : 'Generate Invitation Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
