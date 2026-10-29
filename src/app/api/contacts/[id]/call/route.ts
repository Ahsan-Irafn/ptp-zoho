import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { permissions } from '@/lib/auth/permissions';
import { CallOutcome } from '@/types/crm';

export async function POST(
  req: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contact = db.contacts.findById(params.id);
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    if (!permissions.canAccessContact(user.role, user.id, contact)) {
      return NextResponse.json({ error: 'Forbidden: Cannot log call on unassigned contact' }, { status: 403 });
    }

    const { outcome, duration_seconds, notes, next_action, follow_up_date } = await req.json();

    if (!outcome) {
      return NextResponse.json({ error: 'Outcome is required' }, { status: 400 });
    }

    const callLog = db.callLogs.create({
      id: `call_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: contact.organization_id,
      contact_id: contact.id,
      agent_id: user.id,
      timestamp: new Date().toISOString(),
      outcome: outcome as CallOutcome,
      duration_seconds: Number(duration_seconds) || 0,
      notes,
      next_action,
      follow_up_date,
      created_at: new Date().toISOString(),
    });

    // If follow-up date was set, create a task automatically
    if (follow_up_date) {
      db.tasks.create({
        id: `task_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        organization_id: contact.organization_id,
        contact_id: contact.id,
        assigned_agent_id: user.id,
        title: next_action ? `Follow-up: ${next_action}` : `Scheduled Call: ${contact.full_name}`,
        description: notes,
        due_date: follow_up_date,
        priority: 'high',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Record audit event
    db.auditEvents.create({
      organization_id: contact.organization_id,
      actor_id: user.id,
      actor_name: user.full_name,
      action: 'call_logged',
      target_type: 'contact',
      target_id: contact.id,
      details: { outcome, duration_seconds, follow_up_date },
    });

    return NextResponse.json({ success: true, callLog });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
