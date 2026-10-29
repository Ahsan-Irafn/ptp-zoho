'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ModuleDefinition, 
  FieldDefinition, 
  CustomFieldType, 
  Profile, 
  Organization,
  Role
} from '@/types/crm';
import { 
  Layers, 
  Plus, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Briefcase, 
  Award, 
  FileText, 
  CheckSquare, 
  Globe, 
  Users, 
  Settings, 
  Eye, 
  EyeOff, 
  Archive, 
  RotateCcw, 
  Edit3, 
  Search, 
  Columns,
  HelpCircle,
  Tag,
  AlertTriangle,
  ChevronRight,
  Info
} from 'lucide-react';

interface ModulesAndFieldsClientProps {
  initialModules: ModuleDefinition[];
  initialFields: FieldDefinition[];
  currentUser: Profile;
  organization: Organization;
}

const AVAILABLE_ICONS: { [key: string]: React.ElementType } = {
  Building2,
  Briefcase,
  Award,
  FileText,
  CheckSquare,
  Globe,
  Users,
  Layers,
};

const FIELD_TYPES: { type: CustomFieldType; label: string; description: string }[] = [
  { type: 'short_text', label: 'Short Text', description: 'Single line text (up to 255 characters)' },
  { type: 'long_text', label: 'Long Text', description: 'Multi-line notes and descriptions' },
  { type: 'email', label: 'Email Address', description: 'Validated email input' },
  { type: 'phone', label: 'Phone Number', description: 'Australian and international phone format' },
  { type: 'number', label: 'Number / Currency', description: 'Numeric values with min/max rules' },
  { type: 'date', label: 'Date', description: 'Calendar date picker' },
  { type: 'datetime', label: 'Date & Time', description: 'Date and Adelaide time' },
  { type: 'single_select', label: 'Single Select Dropdown', description: 'Pick one option from a curated list' },
  { type: 'multi_select', label: 'Multi-Select Dropdown', description: 'Select multiple tags or qualifications' },
  { type: 'checkbox', label: 'Checkbox (Yes / No)', description: 'Binary boolean flag' },
  { type: 'url', label: 'Website / URL', description: 'Clickable web link' },
  { type: 'user_reference', label: 'Advisor / User Reference', description: 'Link to a team member profile' },
  { type: 'record_relationship', label: 'CRM Record Relationship', description: 'Link to an authorized CRM contact or deal' },
];

export function ModulesAndFieldsClient({
  initialModules,
  initialFields,
  currentUser,
  organization,
}: ModulesAndFieldsClientProps) {
  const [activeTab, setActiveTab] = useState<'modules' | 'fields'>('modules');
  const [modules, setModules] = useState<ModuleDefinition[]>(initialModules);
  const [fields, setFields] = useState<FieldDefinition[]>(initialFields);

  // Selected module for Field Builder tab
  const [selectedModuleKey, setSelectedModuleKey] = useState<string>('contacts');
  const [fieldSearch, setFieldSearch] = useState('');
  const [showArchivedFields, setShowArchivedFields] = useState(false);

  // Modals state
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleDefinition | null>(null);

  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);

  const [depModalOpen, setDepModalOpen] = useState(false);
  const [depInfo, setDepInfo] = useState<{ field: FieldDefinition; recordCount: number; message: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states for Module Modal
  const [modName, setModName] = useState('');
  const [modSingular, setModSingular] = useState('');
  const [modKey, setModKey] = useState('');
  const [modDesc, setModDesc] = useState('');
  const [modIcon, setModIcon] = useState('Building2');
  const [modPos, setModPos] = useState(10);
  const [modAgentAccess, setModAgentAccess] = useState<'none' | 'assigned_only' | 'all'>('none');

  // Form states for Field Modal
  const [fldModule, setFldModule] = useState('contacts');
  const [fldLabel, setFldLabel] = useState('');
  const [fldKey, setFldKey] = useState('');
  const [fldType, setFldType] = useState<CustomFieldType>('short_text');
  const [fldSection, setFldSection] = useState('General');
  const [fldHelp, setFldHelp] = useState('');
  const [fldPlaceholder, setFldPlaceholder] = useState('');
  const [fldRequired, setFldRequired] = useState(false);
  const [fldOwnerOnlyView, setFldOwnerOnlyView] = useState(false);
  const [fldOwnerOnlyEdit, setFldOwnerOnlyEdit] = useState(false);
  const [fldShowTable, setFldShowTable] = useState(true);
  const [fldShowForm, setFldShowForm] = useState(true);
  const [fldShowDetail, setFldShowDetail] = useState(true);
  const [fldOptionsText, setFldOptionsText] = useState('');

  const openCreateModule = () => {
    setEditingModule(null);
    setModName('');
    setModSingular('');
    setModKey('');
    setModDesc('');
    setModIcon('Building2');
    setModPos(modules.length + 2);
    setModAgentAccess('none');
    setModuleModalOpen(true);
  };

  const openEditModule = (mod: ModuleDefinition) => {
    setEditingModule(mod);
    setModName(mod.name);
    setModSingular(mod.singular_name);
    setModKey(mod.key);
    setModDesc(mod.description);
    setModIcon(mod.icon || 'Building2');
    setModPos(mod.sidebar_position || 10);
    setModAgentAccess(mod.agent_access);
    setModuleModalOpen(true);
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    try {
      if (editingModule) {
        // Edit module
        const res = await fetch('/api/settings/modules', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: editingModule.key,
            name: modName,
            singular_name: modSingular,
            description: modDesc,
            icon: modIcon,
            sidebar_position: Number(modPos),
            agent_access: modAgentAccess,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setModules(modules.map(m => m.key === editingModule.key ? data.module : m));
        setStatusMsg({ type: 'success', text: `Module '${modName}' updated successfully.` });
      } else {
        // Create module
        const res = await fetch('/api/settings/modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: modName,
            singular_name: modSingular,
            key: modKey || modName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            description: modDesc,
            icon: modIcon,
            sidebar_position: Number(modPos),
            agent_access: modAgentAccess,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setModules([...modules, data.module]);
        setStatusMsg({ type: 'success', text: `Module '${data.module.name}' created successfully.` });
      }
      setModuleModalOpen(false);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const openCreateField = () => {
    setEditingField(null);
    setFldModule(selectedModuleKey);
    setFldLabel('');
    setFldKey('');
    setFldType('short_text');
    setFldSection('General');
    setFldHelp('');
    setFldPlaceholder('');
    setFldRequired(false);
    setFldOwnerOnlyView(false);
    setFldOwnerOnlyEdit(false);
    setFldShowTable(true);
    setFldShowForm(true);
    setFldShowDetail(true);
    setFldOptionsText('');
    setFieldModalOpen(true);
  };

  const openEditField = (f: FieldDefinition) => {
    setEditingField(f);
    setFldModule(f.module_key);
    setFldLabel(f.label);
    setFldKey(f.field_key);
    setFldType(f.field_type);
    setFldSection(f.section || 'General');
    setFldHelp(f.help_text || '');
    setFldPlaceholder(f.placeholder || '');
    setFldRequired(f.is_required);
    setFldOwnerOnlyView(f.is_owner_only_view);
    setFldOwnerOnlyEdit(f.is_owner_only_edit);
    setFldShowTable(f.show_in_table);
    setFldShowForm(f.show_in_form);
    setFldShowDetail(f.show_in_detail);
    setFldOptionsText(f.options ? f.options.map(o => o.label).join('\n') : '');
    setFieldModalOpen(true);
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    try {
      const parsedOptions = fldOptionsText.trim()
        ? fldOptionsText.split('\n').map(line => line.trim()).filter(Boolean).map(label => ({
            label,
            value: label,
          }))
        : undefined;

      if (editingField) {
        // Safe update: modifies label, section, options, permissions without touching stable field_key
        const res = await fetch('/api/settings/fields', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingField.id,
            label: fldLabel,
            section: fldSection,
            help_text: fldHelp,
            placeholder: fldPlaceholder,
            is_required: fldRequired,
            is_owner_only_view: fldOwnerOnlyView,
            is_owner_only_edit: fldOwnerOnlyEdit,
            show_in_table: fldShowTable,
            show_in_form: fldShowForm,
            show_in_detail: fldShowDetail,
            options: parsedOptions,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setFields(fields.map(f => f.id === editingField.id ? data.field : f));
        setStatusMsg({ type: 'success', text: `Field '${fldLabel}' updated successfully.` });
      } else {
        // Create field
        const res = await fetch('/api/settings/fields', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            module_key: fldModule,
            field_key: fldKey || fldLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            label: fldLabel,
            field_type: fldType,
            section: fldSection,
            help_text: fldHelp,
            placeholder: fldPlaceholder,
            is_required: fldRequired,
            is_owner_only_view: fldOwnerOnlyView,
            is_owner_only_edit: fldOwnerOnlyEdit,
            show_in_table: fldShowTable,
            show_in_form: fldShowForm,
            show_in_detail: fldShowDetail,
            options: parsedOptions,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setFields([...fields, data.field]);
        setStatusMsg({ type: 'success', text: `Custom field '${data.field.label}' created successfully.` });
      }
      setFieldModalOpen(false);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveClick = async (field: FieldDefinition) => {
    if (field.is_system) {
      alert('Protected system fields cannot be archived.');
      return;
    }

    try {
      // Check dependencies first
      const res = await fetch(`/api/settings/fields?id=${field.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFields(fields.map(f => f.id === field.id ? { ...f, is_archived: true } : f));
      setStatusMsg({
        type: 'success',
        text: `Field '${field.label}' archived safely. Historical data in ${data.dependencies?.recordCount || 0} records preserved.`
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleRestoreField = async (field: FieldDefinition) => {
    try {
      const res = await fetch('/api/settings/fields', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: field.id, is_archived: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFields(fields.map(f => f.id === field.id ? data.field : f));
      setStatusMsg({ type: 'success', text: `Field '${field.label}' restored successfully.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  // Filtered fields for active module
  const currentModuleFields = fields
    .filter(f => f.module_key === selectedModuleKey)
    .filter(f => showArchivedFields ? true : !f.is_archived)
    .filter(f => {
      if (!fieldSearch) return true;
      const q = fieldSearch.toLowerCase();
      return f.label.toLowerCase().includes(q) || f.field_key.toLowerCase().includes(q) || (f.section && f.section.toLowerCase().includes(q));
    });

  // Group fields by section
  const sections = Array.from(new Set(currentModuleFields.map(f => f.section || 'General')));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Owner Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Link href="/settings" className="text-slate-500 hover:text-blue-900 font-semibold text-sm transition-colors">
              Business Settings
            </Link>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-700" /> Owner Only Module &amp; Field Builder
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Modules &amp; Custom Fields
          </h1>
          <p className="text-base text-slate-600 mt-1 max-w-3xl">
            Design custom modules, configure table layouts, and define validated custom properties with server-level access rules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'modules' ? (
            <button
              onClick={openCreateModule}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-[#20409A] hover:bg-[#183279] text-white text-[15px] font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-colors min-h-[44px]"
            >
              <Plus className="w-5 h-5" /> Create Custom Module
            </button>
          ) : (
            <button
              onClick={openCreateField}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-[#20409A] hover:bg-[#183279] text-white text-[15px] font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-colors min-h-[44px]"
            >
              <Plus className="w-5 h-5" /> Add Custom Field
            </button>
          )}
        </div>
      </div>

      {/* Status banner */}
      {statusMsg && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-sm font-semibold">{statusMsg.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('modules')}
          className={`pb-3 px-2 font-bold text-base transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'modules'
              ? 'border-[#20409A] text-[#20409A]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers className="w-5 h-5" /> CRM Modules ({modules.length})
        </button>
        <button
          onClick={() => setActiveTab('fields')}
          className={`pb-3 px-2 font-bold text-base transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'fields'
              ? 'border-[#20409A] text-[#20409A]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Tag className="w-5 h-5" /> Field Definitions &amp; Rules
        </button>
      </div>

      {/* TAB 1: MODULES MANAGEMENT */}
      {activeTab === 'modules' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map(mod => {
              const IconComp = AVAILABLE_ICONS[mod.icon] || Building2;
              const fieldCount = fields.filter(f => f.module_key === mod.key && !f.is_archived).length;

              return (
                <div 
                  key={mod.key} 
                  className={`bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all ${
                    mod.is_enabled ? 'border-slate-200 hover:border-blue-300' : 'border-slate-200 bg-slate-50 opacity-75'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#20409A] shrink-0">
                        <IconComp className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {mod.is_system ? (
                          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wide">
                            Protected System
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wide">
                            Custom Module
                          </span>
                        )}
                        <span className={`text-[12px] font-semibold ${
                          mod.agent_access === 'none' 
                            ? 'text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200' 
                            : 'text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200'
                        }`}>
                          {mod.agent_access === 'none' ? '🔒 Owner Only' : '👥 Agent Permitted'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900 leading-snug">
                        {mod.name}
                      </h3>
                      <div className="text-xs font-mono text-slate-500 mt-0.5">
                        Key: {mod.key} &bull; Position: #{mod.sidebar_position}
                      </div>
                      <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                        {mod.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                      <span>{fieldCount} Properties Defined</span>
                      <span>{mod.table_columns?.length || 0} Table Columns</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedModuleKey(mod.key);
                        setActiveTab('fields');
                      }}
                      className="text-xs font-bold text-[#20409A] hover:underline flex items-center gap-1"
                    >
                      <Tag className="w-3.5 h-3.5" /> Manage Fields
                    </button>

                    <div className="flex items-center gap-2">
                      {!mod.is_system && (
                        <Link
                          href={`/modules/${mod.key}`}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        >
                          View Records &rarr;
                        </Link>
                      )}
                      <button
                        onClick={() => openEditModule(mod)}
                        className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit Module Config"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: FIELD DEFINITIONS */}
      {activeTab === 'fields' && (
        <div className="space-y-6">
          {/* Module Selector & Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm font-bold text-slate-700 whitespace-nowrap">
                Select Module:
              </label>
              <select
                value={selectedModuleKey}
                onChange={e => setSelectedModuleKey(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {modules.map(m => (
                  <option key={m.key} value={m.key}>
                    {m.name} ({m.key}) {m.is_system ? '— System' : '— Custom'}
                  </option>
                ))}
              </select>

              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={fieldSearch}
                  onChange={e => setFieldSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showArchivedFields}
                  onChange={e => setShowArchivedFields(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Show Archived Fields
              </label>

              <button
                onClick={openCreateField}
                className="inline-flex items-center justify-center gap-1.5 bg-[#20409A] hover:bg-[#183279] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Add Field to {modules.find(m => m.key === selectedModuleKey)?.singular_name || 'Module'}
              </button>
            </div>
          </div>

          {/* Fields Grouped by Section */}
          <div className="space-y-6">
            {sections.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
                <Tag className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-800">No fields found for this module</h3>
                <p className="text-sm text-slate-500 mt-1">Click &ldquo;Add Custom Field&rdquo; above to define a new property.</p>
              </div>
            ) : (
              sections.map(section => {
                const sectionFields = currentModuleFields.filter(f => (f.section || 'General') === section);
                if (sectionFields.length === 0) return null;

                return (
                  <div key={section} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-slate-50/80 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-[15px] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                        {section} ({sectionFields.length})
                      </h3>
                      <span className="text-xs font-semibold text-slate-500">
                        Stable Internal Storage
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm min-w-[900px]">
                        <thead className="bg-white border-b border-slate-100 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                          <tr>
                            <th className="py-3 px-5 whitespace-nowrap">Display Label &amp; Internal Key</th>
                            <th className="py-3 px-4 whitespace-nowrap">Field Type</th>
                            <th className="py-3 px-4 whitespace-nowrap">Requirement</th>
                            <th className="py-3 px-4 whitespace-nowrap">Access &amp; Security</th>
                            <th className="py-3 px-4 whitespace-nowrap">Display Places</th>
                            <th className="py-3 px-5 text-right whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sectionFields.map(field => {
                            const typeObj = FIELD_TYPES.find(t => t.type === field.field_type);

                            return (
                              <tr 
                                key={field.id} 
                                className={`hover:bg-slate-50/70 transition-colors ${
                                  field.is_archived ? 'bg-slate-50 text-slate-400' : ''
                                }`}
                              >
                                <td className="py-3.5 px-5">
                                  <div className="font-bold text-slate-900 text-base">
                                    {field.label}
                                  </div>
                                  <div className="font-mono text-xs text-slate-500 mt-0.5">
                                    {field.field_key}
                                  </div>
                                  {field.help_text && (
                                    <div className="text-xs text-slate-500 mt-1 italic">
                                      {field.help_text}
                                    </div>
                                  )}
                                </td>

                                <td className="py-3.5 px-4">
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-900 border border-blue-200 whitespace-nowrap">
                                    {typeObj?.label || field.field_type}
                                  </span>
                                  {field.options && field.options.length > 0 && (
                                    <div className="text-[11px] text-slate-500 mt-1">
                                      {field.options.length} option(s) configured
                                    </div>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  {field.is_required ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      Required
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-500 font-medium">
                                      Optional
                                    </span>
                                  )}
                                </td>

                                <td className="py-3.5 px-4">
                                  {field.is_owner_only_view ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 whitespace-nowrap">
                                      <Lock className="w-3.5 h-3.5 text-amber-700" /> Owner Only (Redacted)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                      <Eye className="w-3.5 h-3.5 text-emerald-600" /> Permitted Agents
                                    </span>
                                  )}
                                </td>

                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 flex-wrap">
                                    {field.show_in_form && <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px]">Form</span>}
                                    {field.show_in_table && <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px]">Table</span>}
                                    {field.show_in_detail && <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px]">Detail</span>}
                                  </div>
                                </td>

                                <td className="py-3.5 px-5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => openEditField(field)}
                                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                      title="Edit Label & Settings"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>

                                    {field.is_archived ? (
                                      <button
                                        onClick={() => handleRestoreField(field)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Restore Field"
                                      >
                                        <RotateCcw className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      !field.is_system && (
                                        <button
                                          onClick={() => handleArchiveClick(field)}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                          title="Archive Field Safely"
                                        >
                                          <Archive className="w-4 h-4" />
                                        </button>
                                      )
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE / EDIT MODULE */}
      {moduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-900" />
                {editingModule ? `Edit Module: ${editingModule.name}` : 'Create New Custom Module'}
              </h2>
              <button
                onClick={() => setModuleModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveModule} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Module Plural Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Employers & Industry Partners"
                  value={modName}
                  onChange={e => {
                    setModName(e.target.value);
                    if (!editingModule && !modKey) {
                      setModKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Singular Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Employer"
                    value={modSingular}
                    onChange={e => setModSingular(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Internal Slug Key *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingModule}
                    placeholder="e.g. employers"
                    value={modKey}
                    onChange={e => setModKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 font-mono text-sm text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Purpose of this module..."
                  value={modDesc}
                  onChange={e => setModDesc(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Sidebar Icon
                  </label>
                  <select
                    value={modIcon}
                    onChange={e => setModIcon(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    {Object.keys(AVAILABLE_ICONS).map(iconName => (
                      <option key={iconName} value={iconName}>
                        {iconName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Sidebar Position
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={modPos}
                    onChange={e => setModPos(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Agent Access Permissions
                </label>
                <select
                  value={modAgentAccess}
                  onChange={e => setModAgentAccess(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="none">🔒 Owner-Only Access (Ayesha & Maryam cannot view)</option>
                  <option value="assigned_only">👥 Calling Agents: Assigned records only</option>
                  <option value="all">🌐 Calling Agents: All module records</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  New modules default to Owner-Only until explicitly granted.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModuleModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#20409A] hover:bg-[#183279] text-white px-5 py-2 text-sm font-semibold rounded-xl shadow transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingModule ? 'Save Module' : 'Create Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT CUSTOM FIELD */}
      {fieldModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-900" />
                {editingField ? `Edit Field: ${editingField.label}` : 'Add Custom Field'}
              </h2>
              <button
                onClick={() => setFieldModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveField} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Display Label *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Funding Eligibility"
                    value={fldLabel}
                    onChange={e => {
                      setFldLabel(e.target.value);
                      if (!editingField && !fldKey) {
                        setFldKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Stable Internal Key *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingField}
                    placeholder="e.g. funding_eligibility"
                    value={fldKey}
                    onChange={e => setFldKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 font-mono text-sm text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Field Type *
                  </label>
                  <select
                    value={fldType}
                    disabled={!!editingField && editingField.is_system}
                    onChange={e => setFldType(e.target.value as CustomFieldType)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    {FIELD_TYPES.map(ft => (
                      <option key={ft.type} value={ft.type}>
                        {ft.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Section / Grouping
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Enrolment & Funding"
                    value={fldSection}
                    onChange={e => setFldSection(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {(fldType === 'single_select' || fldType === 'multi_select') && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Dropdown Options (One per line)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Option A&#10;Option B&#10;Option C"
                    value={fldOptionsText}
                    onChange={e => setFldOptionsText(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Placeholder Text
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Enter details..."
                    value={fldPlaceholder}
                    onChange={e => setFldPlaceholder(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Help Text
                  </label>
                  <input
                    type="text"
                    placeholder="Guidance for advisors..."
                    value={fldHelp}
                    onChange={e => setFldHelp(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Requirement & Permissions */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={fldRequired}
                      onChange={e => setFldRequired(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    Required Field
                  </label>
                  <span className="text-xs text-slate-500">Applies to new records</span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-amber-900">
                    <input
                      type="checkbox"
                      checked={fldOwnerOnlyView}
                      onChange={e => setFldOwnerOnlyView(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    🔒 Owner-Only Visibility (Redacted from Agents)
                  </label>
                  <span className="text-xs text-slate-500">Strict Server Redaction</span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-amber-900">
                    <input
                      type="checkbox"
                      checked={fldOwnerOnlyEdit}
                      onChange={e => setFldOwnerOnlyEdit(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    🔒 Owner-Only Editing (Read-only for Permitted Agents)
                  </label>
                </div>
              </div>

              {/* Display Placements */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Display Placements:
                </label>
                <div className="flex items-center gap-4 text-sm font-medium text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fldShowForm}
                      onChange={e => setFldShowForm(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    Create / Edit Form
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fldShowTable}
                      onChange={e => setFldShowTable(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    Table Column
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fldShowDetail}
                      onChange={e => setFldShowDetail(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    Record Detail Page
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFieldModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#20409A] hover:bg-[#183279] text-white px-5 py-2 text-sm font-semibold rounded-xl shadow transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingField ? 'Save Field' : 'Add Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
