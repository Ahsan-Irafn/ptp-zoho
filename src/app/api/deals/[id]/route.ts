import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { permissions } from '@/lib/auth/permissions';
import { DealStage } from '@/types/crm';

export async function PATCH(
  req: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const deal = db.deals.findById(params.id);
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

    if (!permissions.canAccessDeal(user.role, user.id, deal)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { stage, loss_reason, notes, value } = await req.json();

    const updates: any = {};
    if (stage) updates.stage = stage as DealStage;
    if (loss_reason !== undefined) updates.loss_reason = loss_reason;
    if (notes !== undefined) updates.notes = notes;
    if (value !== undefined) updates.value = Number(value);

    const updated = db.deals.update(deal.id, updates);

    // Audit Log
    db.auditEvents.create({
      organization_id: deal.organization_id,
      actor_id: user.id,
      actor_name: user.full_name,
      action: 'deal_stage_changed',
      target_type: 'deal',
      target_id: deal.id,
      details: { previous_stage: deal.stage, new_stage: stage, value: deal.value },
    });

    return NextResponse.json({ success: true, deal: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
