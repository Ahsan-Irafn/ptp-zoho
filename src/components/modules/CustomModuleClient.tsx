'use client';

import React, { useState } from 'react';
import { 
  ModuleDefinition, 
  FieldDefinition, 
  CustomRecord, 
  Profile 
} from '@/types/crm';
import { formatAdelaideDateTime } from '@/lib/utils/date';
import { 
  Plus, 
  Search, 
  Layers, 
  Edit3, 
  Archive, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  User, 
  Calendar,
  Building2,
  ExternalLink
} from 'lucide-react';

interface CustomModuleClientProps {
  moduleDef: ModuleDefinition;
  fieldDefs: FieldDefinition[];
  initialRecords: CustomRecord[];
  profiles: Profile[];
  currentUser: Profile;
}

export function CustomModuleClient({
  moduleDef,
  fieldDefs,
  initialRecords,
  profiles,
  currentUser,
}: CustomModuleClientProps) {
  const [records, setRecords] = useState<CustomRecord[]>(initialRecords);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CustomRecord | null>(null);

  const [recordTitle, setRecordTitle] = useState('');
  const [assignedAgentId, setAssignedAgentId] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isOwner = currentUser.role === 'owner';

  // Table columns: show fields marked as show_in_table
  const tableFields = fieldDefs.filter(f => f.show_in_table);

  const openCreateModal = () => {
    setEditingRecord(null);
    setRecordTitle('');
    setAssignedAgentId(currentUser.id);
    const initialValues: Record<string, any> = {};
    fieldDefs.forEach(f => {
      if (f.default_value !== undefined) initialValues[f.field_key] = f.default_value;
    });
    setFormData(initialValues);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEditModal = (rec: CustomRecord) => {
    setEditingRecord(rec);
    setRecordTitle(rec.title);
    setAssignedAgentId(rec.assigned_agent_id || '');
    setFormData({ ...(rec.data || {}) });
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      if (editingRecord) {
        const res = await fetch(`/api/modules/${moduleDef.key}/records`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingRecord.id,
            title: recordTitle,
            assigned_agent_id: assignedAgentId || undefined,
            data: formData,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setRecords(records.map(r => r.id === editingRecord.id ? data.record : r));
      } else {
        const res = await fetch(`/api/modules/${moduleDef.key}/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: recordTitle,
            assigned_agent_id: assignedAgentId || undefined,
            data: formData,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setRecords([data.record, ...records]);
      }
      setModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (rec: CustomRecord) => {
    if (!isOwner) return;

    try {
      const res = await fetch(`/api/modules/${moduleDef.key}/records`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rec.id,
          is_archived: !rec.is_archived,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setRecords(records.map(r => r.id === rec.id ? data.record : r));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredRecords = records.filter(r => {
    if (!showArchived && r.is_archived) return false;
    if (showArchived && !r.is_archived) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchData = r.data && Object.values(r.data).some(v => String(v).toLowerCase().includes(q));
      if (!matchTitle && !matchData) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200 uppercase tracking-wider">
              Custom Module
            </span>
            <span className="text-sm font-medium text-slate-500">
              ({filteredRecords.length} records)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {moduleDef.name}
          </h1>
          <p className="text-base text-slate-600 mt-1 max-w-3xl">
            {moduleDef.description || `Manage and track ${moduleDef.name.toLowerCase()} within Practical Training Pathways CRM.`}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-[#20409A] hover:bg-[#183279] text-white text-[15px] font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-colors min-h-[44px]"
        >
          <Plus className="w-5 h-5" /> New {moduleDef.singular_name}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search ${moduleDef.name.toLowerCase()}...`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {isOwner && (
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Show Archived Records
          </label>
        )}
      </div>

      {/* Records Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1050px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[12px] tracking-wider">
              <tr>
                <th className="py-3.5 px-5 whitespace-nowrap min-w-[220px]">
                  {moduleDef.singular_name} Name / Title
                </th>
                {tableFields.map(field => (
                  <th key={field.id} className="py-3.5 px-4 whitespace-nowrap">
                    {field.label}
                  </th>
                ))}
                <th className="py-3.5 px-4 whitespace-nowrap min-w-[150px]">
                  Assigned Advisor
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap min-w-[160px]">
                  Created (Adelaide)
                </th>
                <th className="py-3.5 px-5 text-right whitespace-nowrap w-[100px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={tableFields.length + 4} className="py-12 text-center text-slate-500">
                    No records found in {moduleDef.name}. Click &ldquo;New {moduleDef.singular_name}&rdquo; above to create one.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => {
                  const assignedProfile = profiles.find(p => p.id === rec.assigned_agent_id);

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-5">
                        <button
                          onClick={() => openEditModal(rec)}
                          className="font-bold text-slate-900 hover:text-blue-700 transition-colors text-base text-left block"
                        >
                          {rec.title}
                        </button>
                      </td>

                      {tableFields.map(field => {
                        const val = rec.data ? rec.data[field.field_key] : undefined;

                        let displayVal = '—';
                        if (val !== undefined && val !== null && val !== '') {
                          if (field.field_type === 'checkbox') {
                            displayVal = val ? 'Yes' : 'No';
                          } else if (Array.isArray(val)) {
                            displayVal = val.join(', ');
                          } else {
                            displayVal = String(val);
                          }
                        }

                        return (
                          <td key={field.id} className="py-4 px-4 text-slate-700 font-medium whitespace-nowrap">
                            {field.field_type === 'checkbox' ? (
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                val ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {displayVal}
                              </span>
                            ) : (
                              displayVal
                            )}
                          </td>
                        );
                      })}

                      <td className="py-4 px-4 whitespace-nowrap">
                        {assignedProfile ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            {assignedProfile.full_name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatAdelaideDateTime(rec.created_at)}
                      </td>

                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(rec)}
                            className="p-1.5 text-slate-500 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Record"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {isOwner && (
                            <button
                              onClick={() => handleArchiveToggle(rec)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title={rec.is_archived ? 'Restore Record' : 'Archive Record'}
                            >
                              {rec.is_archived ? <RotateCcw className="w-4 h-4 text-blue-600" /> : <Archive className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-900" />
                {editingRecord ? `Edit ${moduleDef.singular_name}` : `New ${moduleDef.singular_name}`}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveRecord} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {moduleDef.singular_name} Name / Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder={`Enter ${moduleDef.singular_name.toLowerCase()} name...`}
                  value={recordTitle}
                  onChange={e => setRecordTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {isOwner && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Assigned Advisor / Agent
                  </label>
                  <select
                    value={assignedAgentId}
                    onChange={e => setAssignedAgentId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">— Unassigned —</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.role === 'owner' ? 'Owner' : 'Calling Agent'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Field Inputs */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Configured Properties
                </h4>

                {fieldDefs.filter(f => f.show_in_form).map(field => {
                  // If agent and field is owner-only edit, disable it
                  const isReadOnly = !isOwner && field.is_owner_only_edit;
                  const fieldVal = formData[field.field_key] ?? '';

                  return (
                    <div key={field.id} className="space-y-1">
                      <label className="block text-sm font-semibold text-slate-700">
                        {field.label} {field.is_required && <span className="text-rose-600">*</span>}
                        {field.is_owner_only_edit && !isOwner && (
                          <span className="text-xs text-amber-700 font-normal ml-1.5">(Read only)</span>
                        )}
                      </label>

                      {field.field_type === 'short_text' && (
                        <input
                          type="text"
                          required={field.is_required}
                          disabled={isReadOnly}
                          placeholder={field.placeholder || ''}
                          value={fieldVal}
                          onChange={e => setFormData({ ...formData, [field.field_key]: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-slate-100"
                        />
                      )}

                      {field.field_type === 'long_text' && (
                        <textarea
                          rows={3}
                          required={field.is_required}
                          disabled={isReadOnly}
                          placeholder={field.placeholder || ''}
                          value={fieldVal}
                          onChange={e => setFormData({ ...formData, [field.field_key]: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-slate-100"
                        />
                      )}

                      {field.field_type === 'email' && (
                        <input
                          type="email"
                          required={field.is_required}
                          disabled={isReadOnly}
                          placeholder={field.placeholder || 'email@example.com'}
                          value={fieldVal}
                          onChange={e => setFormData({ ...formData, [field.field_key]: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-slate-100"
                        />
                      )}

                      {field.field_type === 'phone' && (
                        <input
                          type="tel"
                          required={field.is_required}
                          disabled={isReadOnly}
                          placeholder={field.placeholder || '0412 345 678'}
                          value={fieldVal}
                          onChange={e => setFormData({ ...formData, [field.field_key]: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-slate-100"
                        />
                      )}

                      {field.field_type === 'number' && (
                        <input
                          type="number"
                          required={field.is_required}
                          disabled={isReadOnly}
                          placeholder={field.placeholder || '0'}
                          value={fieldVal}
                          onChange={e => setFormData({ ...formData, [field.field_key]: Number(e.target.value) })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-slate-100"
                        />
                      )}

                      {field.field_type === 'date' && (
                        <input
                          type="date"
                          required={field.is_required}
                          disabled={isReadOnly}
                          value={fieldVal}
                          onChange={e => setFormData({ ...formData, [field.field_key]: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-slate-100"
                        />
                      )}

                      {field.field_type === 'single_select' && (
                        <select
                          required={field.is_required}
                          disabled={isReadOnly}
                          value={fieldVal}
                          onChange={e => setFormData({ ...formData, [field.field_key]: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-slate-100"
                        >
                          <option value="">— Select {field.label} —</option>
                          {field.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {field.field_type === 'checkbox' && (
                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            disabled={isReadOnly}
                            checked={Boolean(formData[field.field_key])}
                            onChange={e => setFormData({ ...formData, [field.field_key]: e.target.checked })}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-slate-800">
                            {field.help_text || field.label}
                          </span>
                        </label>
                      )}

                      {field.help_text && field.field_type !== 'checkbox' && (
                        <p className="text-xs text-slate-500 italic mt-0.5">{field.help_text}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#20409A] hover:bg-[#183279] text-white px-5 py-2 text-sm font-semibold rounded-xl shadow transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingRecord ? 'Save Changes' : `Create ${moduleDef.singular_name}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
