import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { permissions } from '@/lib/auth/permissions';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!permissions.canManageTemplates(user.role)) {
      return NextResponse.json({ error: 'Forbidden: Only owners can manage email templates' }, { status: 403 });
    }

    const { name, slug, subject, body_html, body_text } = await req.json();

    const org = db.organizations.findFirst();
    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 500 });

    const existing = db.emailTemplates.findBySlug(org.id, slug);
    let template;

    if (existing) {
      template = db.emailTemplates.update(existing.id, {
        name,
        subject,
        body_html,
        body_text,
      });
    } else {
      template = db.emailTemplates.create({
        id: `tpl_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        organization_id: org.id,
        name,
        slug,
        subject,
        body_html,
        body_text,
        variables: ['contact.name', 'agent.name', 'organization.name', 'unsubscribe_url'],
        is_system: false,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
