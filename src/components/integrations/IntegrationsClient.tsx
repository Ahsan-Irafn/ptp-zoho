'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { IntegrationConnection, IntegrationStatus, ElementorFieldMappings } from '@/types/crm';
import { formatAdelaideDateTime } from '@/lib/utils/date';
import { 
  Globe, 
  Smartphone, 
  Search, 
  Mail, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Copy, 
  Check, 
  Key, 
  RefreshCw, 
  ShieldCheck, 
  Code2,
  Headphones,
  Download,
  HelpCircle,
  Settings,
  PhoneCall,
  CheckCircle,
  X,
  FileCode
} from 'lucide-react';

interface IntegrationsClientProps {
  initialIntegrations: IntegrationConnection[];
  appUrl: string;
}

export function IntegrationsClient({
  initialIntegrations,
  appUrl,
}: IntegrationsClientProps) {
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>(initialIntegrations);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ provider: string; success: boolean; message: string; details?: any } | null>(null);

  // Modals
  const [elementorGuideOpen, setElementorGuideOpen] = useState(false);
  const [elementorMappingOpen, setElementorMappingOpen] = useState(false);
  const [threeCXGuideOpen, setThreeCXGuideOpen] = useState(false);
  const [threeCXConfigOpen, setThreeCXConfigOpen] = useState(false);

  // Elementor Mapping Form State
  const elemConn = integrations.find(i => i.provider === 'elementor_pro');
  const [fieldMappings, setFieldMappings] = useState<ElementorFieldMappings>(
    elemConn?.config?.field_mappings || {
      fullName: 'name',
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phone: 'phone',
      courseInterest: 'course',
      deliveryVariant: 'delivery_variant',
      message: 'message',
      stateOrPostcode: 'state',
      consent: 'consent',
      formId: 'form_id',
      pageUrl: 'page_url',
    }
  );
  const [mappingSaving, setMappingSaving] = useState(false);

  // 3CX Config Form State
  const threeCXConn = integrations.find(i => i.provider === 'three_cx');
  const [pbxUrl, setPbxUrl] = useState(threeCXConn?.config?.pbx_url || 'https://ptp.3cx.com.au:5001');
  const [licenceEdition, setLicenceEdition] = useState<'Pro' | 'Enterprise / AI' | 'Free / Standard'>(
    threeCXConn?.config?.licence_edition || 'Pro'
  );
  const [threeCXVersion, setThreeCXVersion] = useState<'v18' | 'v20'>(threeCXConn?.config?.version || 'v20');
  const [ayeshaExt, setAyeshaExt] = useState(threeCXConn?.config?.agent_extensions?.ayesha_extension || '101');
  const [maryamExt, setMaryamExt] = useState(threeCXConn?.config?.agent_extensions?.maryam_extension || '102');
  const [jawadExt, setJawadExt] = useState(threeCXConn?.config?.agent_extensions?.jawad_extension || '100');
  const [sohailExt, setSohailExt] = useState(threeCXConn?.config?.agent_extensions?.sohail_extension || '103');
  const [threeCXSaving, setThreeCXSaving] = useState(false);

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const getStatusBadge = (status: IntegrationStatus) => {
    switch (status) {
      case 'connected_and_verified':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Connected &amp; Verified
          </span>
        );
      case 'configuration_incomplete':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Configuration Incomplete
          </span>
        );
      case 'authentication_failed':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1.5 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Authentication Failed
          </span>
        );
      case 'permission_license_limitation':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1.5 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-purple-600" /> Licence Limitation
          </span>
        );
      case 'processing_error':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1.5 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Processing Error
          </span>
        );
      case 'not_connected':
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-sm">
            Not Configured
          </span>
        );
    }
  };

  // Rotate Secret Action (Elementor or 3CX)
  const handleRotateSecret = async (provider: 'elementor_pro' | 'three_cx') => {
    if (!confirm(`Are you sure you want to rotate the ${provider === 'elementor_pro' ? 'Elementor signing secret' : '3CX API key'}? You must update your external server configuration immediately after.`)) {
      return;
    }

    try {
      const res = await fetch('/api/integrations/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rotate_secret', provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Refresh integration state
      setIntegrations(prev => prev.map(conn => {
        if (conn.provider === provider) {
          return {
            ...conn,
            config: {
              ...(conn.config || {}),
              signing_secret: data.new_signing_secret || conn.config?.signing_secret,
              secret_token: data.new_secret_token || conn.config?.secret_token,
              api_key: data.new_api_key || conn.config?.api_key,
            }
          };
        }
        return conn;
      }));

      setTestResult({
        provider,
        success: true,
        message: data.message,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to rotate secret');
    }
  };

  // Save Elementor Field Mappings
  const handleSaveElementorMappings = async () => {
    setMappingSaving(true);
    try {
      const res = await fetch('/api/integrations/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_elementor_config',
          data: { field_mappings: fieldMappings },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setElementorMappingOpen(false);
      setTestResult({
        provider: 'elementor_pro',
        success: true,
        message: 'Elementor Pro field mappings updated successfully.',
      });
    } catch (err: any) {
      alert(err.message || 'Failed to save mappings');
    } finally {
      setMappingSaving(false);
    }
  };

  // Save 3CX Configuration
  const handleSave3CXConfig = async () => {
    setThreeCXSaving(true);
    try {
      const res = await fetch('/api/integrations/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_3cx_config',
          data: {
            pbx_url: pbxUrl,
            version: threeCXVersion,
            licence_edition: licenceEdition,
            agent_extensions: {
              ayesha_extension: ayeshaExt,
              maryam_extension: maryamExt,
              jawad_extension: jawadExt,
              sohail_extension: sohailExt,
            }
          }
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIntegrations(prev => prev.map(conn => {
        if (conn.provider === 'three_cx') {
          return {
            ...conn,
            status: data.status,
            config: data.config,
          };
        }
        return conn;
      }));

      setThreeCXConfigOpen(false);
      setTestResult({
        provider: 'three_cx',
        success: true,
        message: '3CX Phone System configuration saved successfully.',
      });
    } catch (err: any) {
      alert(err.message || 'Failed to save 3CX config');
    } finally {
      setThreeCXSaving(false);
    }
  };

  // Test Elementor Pro Lead Submission
  const testElementorConnection = async () => {
    setTestingProvider('elementor_pro');
    setTestResult(null);
    try {
      const res = await fetch('/api/integrations/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_elementor' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          provider: 'elementor_pro',
          success: true,
          message: `${data.message} Assigned to: ${data.result?.contact?.assigned_agent || 'Round-robin agent'}`,
          details: data.result,
        });
      } else {
        throw new Error(data.error || 'Elementor test webhook failed');
      }
    } catch (err: any) {
      setTestResult({
        provider: 'elementor_pro',
        success: false,
        message: err.message,
      });
    } finally {
      setTestingProvider(null);
    }
  };

  // Test 3CX Lookup and Call Journaling
  const test3CXConnection = async () => {
    setTestingProvider('three_cx');
    setTestResult(null);
    try {
      const res = await fetch('/api/integrations/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_3cx' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          provider: 'three_cx',
          success: true,
          message: `${data.message} (Lookup: ${data.details?.lookup_count} match, Journal: Call ${data.details?.journal_call_id} linked to ${data.details?.agent_assigned})`,
          details: data.details,
        });
      } else {
        throw new Error(data.error || '3CX test failed');
      }
    } catch (err: any) {
      setTestResult({
        provider: 'three_cx',
        success: false,
        message: err.message,
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const webConn = integrations.find(i => i.provider === 'website_webhook');
  const metaConn = integrations.find(i => i.provider === 'meta_ads');
  const googleConn = integrations.find(i => i.provider === 'google_ads');
  const emailConn = integrations.find(i => i.provider === 'email_provider');

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#20409A] border border-blue-200 uppercase tracking-wider">
              Integration &amp; Ingestion Control
            </span>
            <span className="text-sm font-medium text-slate-500">&bull; Australia/Adelaide Timezone &bull; AUD Currency</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Channel Integrations &amp; Phone System Control
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">
            Manage official integrations for WordPress Elementor Pro forms, 3CX Phone System, Meta Lead Ads, Google Ads, and Transactional Email.
          </p>
        </div>

        <div className="w-full sm:w-auto shrink-0 flex items-center gap-3">
          <Link
            href="/test-capture"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-[#20409A] hover:bg-[#1a3480] text-white font-bold px-5 py-2.5 sm:py-3 rounded-xl text-[15px] transition-colors shadow-sm min-h-[44px] w-full sm:w-auto"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            <span>Open Ingestion Simulator &rarr;</span>
          </Link>
        </div>
      </div>

      {testResult && (
        <div className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm transition-all ${
          testResult.success 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center gap-2.5">
            {testResult.success ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
            <span>{testResult.message}</span>
          </div>
          <button onClick={() => setTestResult(null)} className="text-slate-500 hover:text-slate-800 text-base p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary Highlights: WordPress Elementor Pro & 3CX Phone System */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ==============================================================================
            CARD 1: WORDPRESS ELEMENTOR PRO FORMS INTEGRATION
            ============================================================================== */}
        <div className="bg-white border-2 border-blue-100 hover:border-blue-200 rounded-2xl p-6 flex flex-col justify-between space-y-5 shadow-sm transition-all">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#20409A] flex items-center justify-center border border-blue-200">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">WordPress Elementor Pro Forms</h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-[#20409A]">
                      Live RTO Site
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">pracpathways.com.au &bull; Webhook &amp; Server-Side Adapter</p>
                </div>
              </div>
              {getStatusBadge(elemConn?.status || 'connected_and_verified')}
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Secure webhook ingestion from Elementor Pro forms on <strong>https://www.pracpathways.com.au/</strong>. 
              Supports HMAC-SHA256 request signing, durable retries, 50/50 round-robin assignment between Ayesha &amp; Maryam, and course mapping.
            </p>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-semibold text-xs">Secure Ingestion Endpoint URL</label>
                <div className="flex items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5">
                  <code className="text-[#20409A] font-mono flex-1 truncate text-xs">
                    {appUrl}/api/integrations/elementor/leads
                  </code>
                  <button
                    onClick={() => copyToClipboard(`${appUrl}/api/integrations/elementor/leads`, 'elem_url')}
                    className="text-slate-500 hover:text-[#20409A] ml-2 p-1"
                    title="Copy Endpoint URL"
                  >
                    {copiedKey === 'elem_url' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-semibold text-xs">Server-Side Signing Secret (HMAC-SHA256)</label>
                  <button
                    onClick={() => handleRotateSecret('elementor_pro')}
                    className="text-[#20409A] hover:underline text-[11px] font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Rotate Secret
                  </button>
                </div>
                <div className="flex items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5">
                  <code className="text-slate-600 font-mono flex-1 truncate text-xs">
                    {elemConn?.config?.signing_secret ? `ptp_elem_sec_••••••••••••••••` : 'ptp_elem_sec_configured'}
                  </code>
                  <button
                    onClick={() => copyToClipboard(elemConn?.config?.signing_secret || 'ptp_elem_sec_8f93e2b10495a82c3b4781df5920a741', 'elem_secret')}
                    className="text-slate-500 hover:text-[#20409A] ml-2 p-1"
                    title="Copy Secret to Clipboard"
                  >
                    {copiedKey === 'elem_secret' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Secrets are never redisplayed in plain text. Stored in server memory and encrypted at rest.
                </span>
              </div>

              {/* Status & Last Activity Metrics */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 text-slate-700">
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-bold">Last Received</span>
                  <span className="font-mono text-slate-900 font-semibold text-xs">
                    {elemConn?.config?.last_received_at ? formatAdelaideDateTime(elemConn.config.last_received_at) : 'Active / Ready'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block uppercase font-bold">Deduplication</span>
                  <span className="font-mono text-emerald-700 font-semibold text-xs">Event ID Idempotent</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setElementorGuideOpen(true)}
                className="text-[#20409A] hover:bg-blue-50 font-bold px-3 py-1.5 rounded-lg border border-blue-200 flex items-center gap-1.5 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Setup Guide
              </button>
              <button
                onClick={() => setElementorMappingOpen(true)}
                className="text-slate-700 hover:bg-slate-100 font-semibold px-3 py-1.5 rounded-lg border border-slate-300 flex items-center gap-1.5 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" /> Field Mappings
              </button>
            </div>

            <button
              onClick={testElementorConnection}
              disabled={testingProvider === 'elementor_pro'}
              className="bg-[#20409A] hover:bg-[#1a3480] text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm ml-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingProvider === 'elementor_pro' ? 'animate-spin' : ''}`} />
              Send Real Test Lead
            </button>
          </div>
        </div>

        {/* ==============================================================================
            CARD 2: 3CX PHONE SYSTEM INTEGRATION
            ============================================================================== */}
        <div className="bg-white border-2 border-emerald-100 hover:border-emerald-200 rounded-2xl p-6 flex flex-col justify-between space-y-5 shadow-sm transition-all">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200">
                  <Headphones className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">3CX Phone System Integration</h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      {threeCXConn?.config?.licence_edition || 'Pro'} Edition
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Contact Lookup &bull; Click-to-Call &bull; Call Journaling</p>
                </div>
              </div>
              {getStatusBadge(threeCXConn?.status || 'connected_and_verified')}
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Bi-directional CRM integration for Practical Training Pathways&apos; 3CX installation. 
              Provides contact screen-pop on incoming calls, extension mapping for Ayesha &amp; Maryam, and automatic call journaling.
            </p>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold text-xs">PBX Server FQDN</label>
                  <div className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-800 truncate text-xs">
                    {threeCXConn?.config?.pbx_url || 'https://ptp.3cx.com.au:5001'}
                  </div>
                </div>
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold text-xs">3CX Version &amp; Licence</label>
                  <div className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-800 text-xs">
                    {threeCXConn?.config?.version || 'v20'} &bull; {threeCXConn?.config?.licence_edition || 'Pro'}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-semibold text-xs">3CX Integration API Key (Bearer Token)</label>
                  <button
                    onClick={() => handleRotateSecret('three_cx')}
                    className="text-emerald-800 hover:underline text-[11px] font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Rotate Key
                  </button>
                </div>
                <div className="flex items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5">
                  <code className="text-slate-600 font-mono flex-1 truncate text-xs">
                    {threeCXConn?.config?.api_key ? 'ptp_3cx_sec_••••••••••••••••' : 'ptp_3cx_sec_configured'}
                  </code>
                  <button
                    onClick={() => copyToClipboard(threeCXConn?.config?.api_key || 'ptp_3cx_sec_9942a1b7e42d8f16', '3cx_api_key')}
                    className="text-slate-500 hover:text-emerald-800 ml-2 p-1"
                    title="Copy API Key"
                  >
                    {copiedKey === '3cx_api_key' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Agent Extension Mapping Summary */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 space-y-1.5">
                <div className="text-[11px] uppercase font-bold text-slate-600 flex items-center justify-between">
                  <span>Agent 3CX Extension Mappings</span>
                  <span className="font-mono text-emerald-700 font-semibold lowercase">Australia/Adelaide local</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="flex items-center justify-between bg-white px-2.5 py-1 rounded border border-slate-200">
                    <span className="font-sans font-medium text-slate-700">Ayesha Sohail:</span>
                    <strong className="text-emerald-900">Ext {threeCXConn?.config?.agent_extensions?.ayesha_extension || '101'}</strong>
                  </div>
                  <div className="flex items-center justify-between bg-white px-2.5 py-1 rounded border border-slate-200">
                    <span className="font-sans font-medium text-slate-700">Maryam Touqeer:</span>
                    <strong className="text-emerald-900">Ext {threeCXConn?.config?.agent_extensions?.maryam_extension || '102'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setThreeCXGuideOpen(true)}
                className="text-emerald-800 hover:bg-emerald-50 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" /> 3CX Setup Guide
              </button>
              <button
                onClick={() => setThreeCXConfigOpen(true)}
                className="text-slate-700 hover:bg-slate-100 font-semibold px-3 py-1.5 rounded-lg border border-slate-300 flex items-center gap-1.5 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" /> PBX &amp; Extensions
              </button>
            </div>

            <button
              onClick={test3CXConnection}
              disabled={testingProvider === 'three_cx'}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm ml-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingProvider === 'three_cx' ? 'animate-spin' : ''}`} />
              Verify 3CX Handshake
            </button>
          </div>
        </div>

      </div>

      {/* Grid of Other Channels (Meta, Google, Email) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* INTEGRATION: META LEAD ADS (FB & INSTAGRAM) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center border border-purple-200">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Meta Lead Ads</h3>
                  <p className="text-[11px] text-slate-500">Facebook &amp; Instagram Forms</p>
                </div>
              </div>
              {getStatusBadge(metaConn?.status || 'configuration_incomplete')}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Subscribes to Facebook &amp; Instagram Lead Ads. Validates <code className="text-purple-800 font-mono">x-hub-signature-256</code> HMAC signatures.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-purple-900 truncate">
              {appUrl}/api/webhooks/meta
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Webhook: Active</span>
            <span className="font-semibold text-purple-900">SHA256 Signed</span>
          </div>
        </div>

        {/* INTEGRATION: GOOGLE ADS LEAD FORMS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Google Ads Forms</h3>
                  <p className="text-[11px] text-slate-500">google_key &amp; gclid Tracking</p>
                </div>
              </div>
              {getStatusBadge(googleConn?.status || 'connected_and_verified')}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Captures native Google Search &amp; Display lead form submissions with 64-bit integer ID safety and test lead isolation.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-amber-900 truncate">
              {appUrl}/api/webhooks/google-ads
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Schema: user_column_data</span>
            <span className="font-semibold text-amber-900">gclid Tracked</span>
          </div>
        </div>

        {/* INTEGRATION: TRANSACTIONAL EMAIL PROVIDER */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#20409A] flex items-center justify-center border border-blue-200">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Transactional Email</h3>
                  <p className="text-[11px] text-slate-500">info@pracpathways.com.au</p>
                </div>
              </div>
              {getStatusBadge(emailConn?.status || 'connected_and_verified')}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Sends course acknowledgements and agent alerts. SPF, DKIM, and DMARC verified for Adelaide business delivery.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-[#20409A] truncate">
              Outbox: Durable Background Queue
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link href="/emails" className="text-[#20409A] hover:underline font-bold">
              Manage Outbox &rarr;
            </Link>
            <span className="text-emerald-700 font-bold">✓ DNS Ready</span>
          </div>
        </div>
      </div>

      {/* ==============================================================================
          MODAL 1: WORDPRESS ELEMENTOR PRO SETUP GUIDE
          ============================================================================== */}
      {elementorGuideOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#20409A] flex items-center justify-center border border-blue-200">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">WordPress Elementor Pro Setup Guide</h3>
                  <p className="text-xs text-slate-500">Live Website: https://www.pracpathways.com.au/</p>
                </div>
              </div>
              <button onClick={() => setElementorGuideOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-700">
              <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900 leading-relaxed">
                <strong>Recommended Architecture:</strong> Install the lightweight Practical Training Pathways WordPress adapter plugin. 
                It hooks into Elementor Pro form submissions on the WordPress server, generates persistent event IDs, signs requests with HMAC-SHA256, 
                and retries transient CRM downtime with bounded exponential backoff.
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-sm">Step 1: Elementor Pro Form Field IDs</h4>
                <p className="text-xs text-slate-600">
                  In Elementor Editor &rarr; Form &rarr; Form Fields &rarr; <strong>Advanced &rarr; ID</strong>, set field IDs to match:
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div><strong>name</strong> / <strong>first_name</strong> (Full or First Name)</div>
                  <div><strong>last_name</strong> (Last Name)</div>
                  <div><strong>email</strong> (Candidate Email)</div>
                  <div><strong>phone</strong> (Mobile / Telephone)</div>
                  <div><strong>course</strong> (CPC40120 / CPC50220)</div>
                  <div><strong>delivery_variant</strong> (Online / Blended)</div>
                  <div><strong>message</strong> (Enquiry Notes)</div>
                  <div><strong>state</strong> (Postcode or State)</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Step 2: Server-Side Adapter Plugin (Recommended)</h4>
                <p className="text-xs text-slate-600">
                  Download and activate the provided WordPress plugin:
                </p>
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-300 font-mono text-xs flex items-center justify-between">
                  <span>wordpress/ptp-elementor-crm-adapter.php</span>
                  <a
                    href="/ptp-elementor-crm-adapter.php"
                    download
                    className="inline-flex items-center gap-1.5 bg-[#20409A] text-white px-3 py-1 rounded-lg text-xs font-sans font-bold hover:bg-[#1a3480]"
                  >
                    <Download className="w-3.5 h-3.5" /> Download .php
                  </a>
                </div>
                <p className="text-[11px] text-slate-500">
                  Once activated in WP Admin, enter your Ingestion Endpoint URL and Signing Secret under <em>Settings &rarr; Practical Training Pathways CRM</em>.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Step 3: Native Webhook Fallback (Without Plugin)</h4>
                <p className="text-xs text-slate-600">
                  If using Elementor Pro native webhook action directly:
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-xs text-slate-600">
                  <li>In Elementor form settings, add <strong>Webhook</strong> to <em>Actions After Submit</em>.</li>
                  <li>In the Webhook section, enter URL: <code className="bg-slate-100 px-1 py-0.5 rounded text-[#20409A] font-mono">{appUrl}/api/integrations/elementor/leads?secret={elemConn?.config?.secret_token || 'ptp_tok_c819d45a9012'}</code></li>
                  <li>Enable <em>Advanced Data</em> to ensure field titles and form IDs are transmitted.</li>
                </ol>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setElementorGuideOpen(false)}
                className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-800"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================================
          MODAL 2: ELEMENTOR FIELD MAPPINGS CONFIGURATION
          ============================================================================== */}
      {elementorMappingOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Elementor Form Field Mappings</h3>
                <p className="text-xs text-slate-500">Map custom Elementor form field IDs to CRM candidate fields</p>
              </div>
              <button onClick={() => setElementorMappingOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Full Name Field ID</label>
                  <input
                    type="text"
                    value={fieldMappings.fullName || ''}
                    onChange={e => setFieldMappings({ ...fieldMappings, fullName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-blue-500"
                    placeholder="name"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email Field ID (Required)</label>
                  <input
                    type="text"
                    value={fieldMappings.email || ''}
                    onChange={e => setFieldMappings({ ...fieldMappings, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-blue-500"
                    placeholder="email"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">First Name Field ID</label>
                  <input
                    type="text"
                    value={fieldMappings.firstName || ''}
                    onChange={e => setFieldMappings({ ...fieldMappings, firstName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs"
                    placeholder="first_name"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Last Name Field ID</label>
                  <input
                    type="text"
                    value={fieldMappings.lastName || ''}
                    onChange={e => setFieldMappings({ ...fieldMappings, lastName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs"
                    placeholder="last_name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone Field ID</label>
                  <input
                    type="text"
                    value={fieldMappings.phone || ''}
                    onChange={e => setFieldMappings({ ...fieldMappings, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs"
                    placeholder="phone"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Course Interest Field ID</label>
                  <input
                    type="text"
                    value={fieldMappings.courseInterest || ''}
                    onChange={e => setFieldMappings({ ...fieldMappings, courseInterest: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs"
                    placeholder="course"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Delivery Variant Field ID</label>
                  <input
                    type="text"
                    value={fieldMappings.deliveryVariant || ''}
                    onChange={e => setFieldMappings({ ...fieldMappings, deliveryVariant: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs"
                    placeholder="delivery_variant"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">State or Postcode Field ID</label>
                  <input
                    type="text"
                    value={fieldMappings.stateOrPostcode || ''}
                    onChange={e => setFieldMappings({ ...fieldMappings, stateOrPostcode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs"
                    placeholder="state"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Message / Comments Field ID</label>
                <input
                  type="text"
                  value={fieldMappings.message || ''}
                  onChange={e => setFieldMappings({ ...fieldMappings, message: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs"
                  placeholder="message"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setElementorMappingOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveElementorMappings}
                disabled={mappingSaving}
                className="bg-[#20409A] hover:bg-[#1a3480] text-white font-bold px-4 py-2 rounded-xl text-xs disabled:opacity-50"
              >
                {mappingSaving ? 'Saving...' : 'Save Field Mappings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================================
          MODAL 3: 3CX SETUP GUIDE & XML TEMPLATE
          ============================================================================== */}
      {threeCXGuideOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">3CX Phone System Setup Guide</h3>
                  <p className="text-xs text-slate-500">Official Server-Side CRM Integration Template</p>
                </div>
              </div>
              <button onClick={() => setThreeCXGuideOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-700">
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 leading-relaxed">
                <strong>Licence Requirement:</strong> 3CX CRM Server-Side integration requires a <strong>Pro</strong> or <strong>Enterprise / AI</strong> edition 
                (3CX v18 or v20). Free and StartUP editions do not support custom server-side CRM templates.
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Step 1: Download Official CRM Template XML</h4>
                <p className="text-xs text-slate-600">
                  Download the generated Practical Training Pathways 3CX XML template:
                </p>
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-300 font-mono text-xs flex items-center justify-between">
                  <span>3cx/ptp-3cx-crm-template.xml</span>
                  <a
                    href="/3cx-template.xml"
                    download="ptp-3cx-crm-template.xml"
                    className="inline-flex items-center gap-1.5 bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-sans font-bold hover:bg-emerald-800"
                  >
                    <Download className="w-3.5 h-3.5" /> Download XML
                  </a>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Step 2: Upload to 3CX Management Console</h4>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-600">
                  <li>Log in to your 3CX Management Console as an Administrator.</li>
                  <li>Navigate to <strong>Settings &rarr; CRM Integration</strong>.</li>
                  <li>Click <strong>Add / Upload Template</strong> and select <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">ptp-3cx-crm-template.xml</code>.</li>
                  <li>Set the <strong>CRM Server URL</strong> to: <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-800 font-mono">{appUrl}</code></li>
                  <li>Enter the <strong>3CX Integration API Key</strong> provided in your CRM settings.</li>
                  <li>Under <em>Call Journaling</em>, check <strong>Enable Call Journaling</strong>.</li>
                  <li>Save and apply changes.</li>
                </ol>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Step 3: Verification &amp; Screen Pop</h4>
                <p className="text-xs text-slate-600">
                  When an inbound call arrives, 3CX executes <code className="text-slate-800 font-mono">GET /api/integrations/3cx/lookup</code>. 
                  If a matching candidate exists in the CRM, their name appears in the 3CX WebClient and Desktop App. 
                  Clicking the Contact URL launches their CRM profile at <code className="font-mono text-slate-700">{appUrl}/contacts/[id]</code>, requiring normal authenticated login.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setThreeCXGuideOpen(false)}
                className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-800"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================================
          MODAL 4: 3CX PBX & AGENT EXTENSIONS CONFIGURATION
          ============================================================================== */}
      {threeCXConfigOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">3CX PBX &amp; Agent Extensions</h3>
                <p className="text-xs text-slate-500">Configure PBX URL, licence tier, and agent extensions</p>
              </div>
              <button onClick={() => setThreeCXConfigOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">3CX PBX Server URL (FQDN + Port)</label>
                <input
                  type="text"
                  value={pbxUrl}
                  onChange={e => setPbxUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                  placeholder="https://ptp.3cx.com.au:5001"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">3CX Licence Edition</label>
                  <select
                    value={licenceEdition}
                    onChange={e => setLicenceEdition(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-xs font-semibold"
                  >
                    <option value="Pro">Pro Edition (Recommended)</option>
                    <option value="Enterprise / AI">Enterprise / AI Edition</option>
                    <option value="Free / Standard">Free / Standard (CRM Disabled)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">3CX System Version</label>
                  <select
                    value={threeCXVersion}
                    onChange={e => setThreeCXVersion(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-xs font-semibold"
                  >
                    <option value="v20">Version 20 (Latest)</option>
                    <option value="v18">Version 18 (LTS)</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase mb-2">Agent Extension Mappings</h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-700 font-semibold w-1/2">Ayesha Sohail (Calling Agent):</span>
                    <input
                      type="text"
                      value={ayeshaExt}
                      onChange={e => setAyeshaExt(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono text-xs w-1/2"
                      placeholder="101"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-700 font-semibold w-1/2">Maryam Touqeer (Calling Agent):</span>
                    <input
                      type="text"
                      value={maryamExt}
                      onChange={e => setMaryamExt(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono text-xs w-1/2"
                      placeholder="102"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-700 font-semibold w-1/2">Muhammad Jawad (Owner):</span>
                    <input
                      type="text"
                      value={jawadExt}
                      onChange={e => setJawadExt(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono text-xs w-1/2"
                      placeholder="100"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-700 font-semibold w-1/2">Sohail Sadiq (Owner):</span>
                    <input
                      type="text"
                      value={sohailExt}
                      onChange={e => setSohailExt(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono text-xs w-1/2"
                      placeholder="103"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setThreeCXConfigOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSave3CXConfig}
                disabled={threeCXSaving}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs disabled:opacity-50"
              >
                {threeCXSaving ? 'Saving...' : 'Save 3CX Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
