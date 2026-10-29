'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Profile } from '@/types/crm';
import { 
  Users, 
  Inbox, 
  PhoneCall, 
  CheckSquare, 
  GraduationCap, 
  Mail, 
  BarChart3, 
  Sliders, 
  ShieldCheck, 
  Settings, 
  LogOut,
  ExternalLink,
  Clock,
  Sparkles,
  BookOpen,
  Menu,
  X,
  Building2,
  Briefcase,
  Award,
  FileText,
  Layers,
  Globe,
} from 'lucide-react';
import { ModuleDefinition } from '@/types/crm';

const MODULE_ICONS: Record<string, React.ElementType> = {
  Building2,
  Briefcase,
  Award,
  FileText,
  CheckSquare,
  Globe,
  Users,
  Layers,
};

interface AppShellProps {
  currentUser: Profile;
  children: React.ReactNode;
}

export function AppShell({ currentUser, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [customModules, setCustomModules] = useState<ModuleDefinition[]>([]);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Fetch enabled custom modules dynamically
  useEffect(() => {
    fetch('/api/settings/modules')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.modules)) {
          setCustomModules(data.modules.filter((m: any) => !m.is_system && m.is_enabled));
        }
      })
      .catch(() => {});
  }, [pathname]);

  // Live Australia/Adelaide Time Clock with DST Awareness
  useEffect(() => {
    const updateTime = () => {
      const timeStr = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Adelaide',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(new Date());
      setCurrentTime(timeStr);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isOwner = currentUser.role === 'owner';

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const navItems = [
    { label: 'Executive Dashboard', href: '/dashboard', icon: BarChart3, show: true },
    { 
      label: isOwner ? 'All Contacts' : 'My Contacts', 
      href: '/contacts', 
      icon: Users, 
      show: true 
    },
    { label: 'Leads & Enquiries', href: '/leads', icon: Inbox, show: true },
    { label: 'Calling Workspace', href: '/calling', icon: PhoneCall, show: true },
    { label: 'Tasks & Follow-ups', href: '/tasks', icon: CheckSquare, show: true },
    { label: 'Course Enquiry Pipeline', href: '/deals', icon: GraduationCap, show: true },
    { label: 'Email Automation', href: '/emails', icon: Mail, show: true },
    ...customModules.map(mod => ({
      label: mod.name,
      href: `/modules/${mod.key}`,
      icon: MODULE_ICONS[mod.icon] || Building2,
      show: isOwner || mod.agent_access !== 'none',
    })),
    { label: 'Executive Reports', href: '/reports', icon: BarChart3, show: isOwner },
    { label: 'Integrations Hub', href: '/integrations', icon: Sliders, show: isOwner },
    { label: 'Modules & Fields', href: '/settings/modules-and-fields', icon: Layers, show: isOwner },
    { label: 'Team Management', href: '/team', icon: Users, show: isOwner },
    { label: 'Audit Security Log', href: '/audit', icon: ShieldCheck, show: isOwner },
    { label: 'Business Settings', href: '/settings', icon: Settings, show: isOwner },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white">
      {/* Brand Banner */}
      <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#20409A] flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-900/20 shrink-0">
            PTP
          </div>
          <div className="min-w-0">
            <div className="text-[16px] font-bold text-slate-900 tracking-tight leading-snug truncate">
              Practical Training
            </div>
            <div className="text-[12px] text-[#20409A] font-semibold tracking-wide uppercase">
              RTO # 22256 &bull; CRM
            </div>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          title="Close Navigation"
        >
          <X className="w-5 h-5 shrink-0" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.filter(item => item.show).map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileNavOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[15px] font-semibold transition-all ${
                isActive
                  ? 'bg-blue-50 text-[#20409A] border border-blue-200/80 shadow-sm font-bold'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#20409A]' : 'text-slate-500'}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Quick Testing Tools & Official Website Link */}
      <div className="p-3 border-t border-slate-200 space-y-1 bg-slate-50/70">
        <div className="text-[11px] uppercase font-bold text-slate-500 px-3 py-1">Direct Links</div>
        <Link
          href="/test-capture"
          onClick={() => setMobileNavOpen(false)}
          className="flex items-center justify-between px-3 py-2 rounded-xl text-[14px] font-medium text-slate-700 hover:bg-white hover:border hover:border-slate-200 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            Webhook Simulator
          </span>
          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">Test</span>
        </Link>
        <a
          href="https://www.pracpathways.com.au"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2 rounded-xl text-[14px] font-medium text-slate-700 hover:bg-white hover:border hover:border-slate-200 transition-colors"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-[#20409A] shrink-0" />
            Official Website
          </span>
          <span className="text-[10px] bg-blue-100 text-[#20409A] px-2 py-0.5 rounded-full font-bold">RTO</span>
        </a>
      </div>

      {/* Authenticated User Card */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <img 
              src={currentUser.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=PTP'} 
              alt={currentUser.full_name} 
              className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-slate-900 truncate">{currentUser.full_name}</div>
              <div className="text-[12px] text-[#20409A] font-semibold capitalize flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {currentUser.role === 'owner' ? 'Business Owner' : 'Calling Agent'}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Sign Out of CRM"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans">
      {/* Desktop Clean White Sidebar (Fixed on lg and above) */}
      <aside className="hidden lg:flex w-72 border-r border-slate-200 bg-white flex-col shrink-0 z-20 shadow-sm">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileNavOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Mobile Drawer (Slides in on mobile/tablet) */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white flex flex-col z-50 shadow-2xl transition-transform duration-200 ease-in-out lg:hidden ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-x-hidden">
        {/* Top Header */}
        <header className="min-h-[56px] sm:min-h-[64px] border-b border-slate-200 bg-white px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm gap-2">
          {/* Left: Mobile Menu Toggle & Adelaide Time Indicator */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 shrink-0" />
            </button>

            {/* Australia/Adelaide Time Indicator */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[12px] sm:text-[14px] shrink-0">
              <Clock className="w-4 h-4 text-[#20409A] shrink-0" />
              <span className="hidden sm:inline text-slate-600 font-medium">Adelaide:</span>
              <strong className="font-mono text-slate-900 font-bold whitespace-nowrap">{currentTime || 'Loading...'}</strong>
            </div>

            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[13px] text-emerald-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Courses: <strong>CPC40120 &amp; CPC50220</strong></span>
            </div>
          </div>

          {/* Right: User Status Badge & Sign Out Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 text-[14px] text-slate-600 truncate max-w-[200px]">
              <span className="truncate">Logged in as </span>
              <strong className="text-slate-900 font-semibold truncate">{currentUser.email.split('@')[0]}</strong>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[13px] sm:text-[14px] font-semibold text-slate-700 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all shrink-0 min-h-[38px] sm:min-h-[40px] whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        </header>

        {/* Page Children with Responsive Scroll & Zoom Handling */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 min-w-0 w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
