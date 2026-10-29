import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { permissions } from '@/lib/auth/permissions';

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Only owners can update organization settings' }, { status: 403 });
    }

    const org = db.organizations.findFirst();
    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 500 });

    const updates = await req.json();
    const updated = db.organizations.update(org.id, updates);

    // Audit Log
    db.auditEvents.create({
      organization_id: org.id,
      actor_id: user.id,
      actor_name: user.full_name,
      action: 'organization_settings_updated',
      target_type: 'organization',
      target_id: org.id,
      details: updates,
    });

    return NextResponse.json({ success: true, organization: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
