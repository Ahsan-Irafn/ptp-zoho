import React from 'react';
import { requireOwner } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { formatAdelaideDateTime } from '@/lib/utils/date';
import { ShieldCheck, ShieldAlert, Key, User, Clock } from 'lucide-react';

export default async function AuditPage() {
  const currentUser = await requireOwner();
  const org = db.organizations.findFirst();
  if (!org) return <div>Organization not found</div>;

  const auditEvents = db.auditEvents.findMany(org.id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 uppercase tracking-wider">
              Append-Only Security Log
            </span>
            <span className="text-sm font-medium text-slate-500">• Owner Visibility Only</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Security Audit Trail
          </h1>
          <p className="text-base text-slate-600 mt-1">
            Immutable log of sensitive actions, authentication events, contact updates, and permission changes in Australia/Adelaide time.
          </p>
        </div>
      </div>

      {/* Audit Events Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase text-xs">
              <tr>
                <th className="py-3.5 px-4">Timestamp (Adelaide)</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Target Type & ID</th>
                <th className="py-3.5 px-4">Details</th>
                <th className="py-3.5 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditEvents.map(event => (
                <tr key={event.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-600 text-xs whitespace-nowrap">
                    {formatAdelaideDateTime(event.created_at)}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                    {event.actor_name}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-1 rounded text-xs font-mono font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                      {event.action}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                    <span className="capitalize text-slate-500">{event.target_type}:</span> {event.target_id}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 text-xs">
                    {event.details ? (
                      <code className="text-slate-800 truncate max-w-xs block font-mono text-xs bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {JSON.stringify(event.details)}
                      </code>
                    ) : '—'}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-500 text-xs">
                    {event.ip_address || '127.0.0.1'}
                  </td>
                </tr>
              ))}

              {auditEvents.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500 text-sm">
                    No audit events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
