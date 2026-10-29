import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Merging is strictly restricted to Owners
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Only owners can merge duplicate contacts' }, { status: 403 });
    }

    const { primaryId, duplicateId } = await req.json();
    if (!primaryId || !duplicateId) {
      return NextResponse.json({ error: 'Both primaryId and duplicateId are required' }, { status: 400 });
    }

    if (primaryId === duplicateId) {
      return NextResponse.json({ error: 'Cannot merge a contact into itself' }, { status: 400 });
    }

    const merged = db.contacts.merge(primaryId, duplicateId, user.id, user.full_name);

    return NextResponse.json({
      success: true,
      message: 'Contacts merged successfully',
      contact: merged,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
