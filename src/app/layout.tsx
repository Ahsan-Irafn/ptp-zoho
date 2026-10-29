import type { Metadata } from 'next';
import './globals.css';
import { getCurrentUser } from '@/lib/auth/session';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Practical Training Pathways CRM',
  description: 'Official CRM for Practical Training Pathways (RTO # 22256). Course enquiry management, calling workspace, building & construction pathways.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();

  // If no user is authenticated, render clean public view (e.g. /login, /invite, /unsubscribe)
  if (!currentUser) {
    return (
      <html lang="en-AU">
        <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
      </html>
    );
  }

  return (
    <html lang="en-AU">
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-blue-100 selection:text-[#20409A]">
        <AppShell currentUser={currentUser}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
