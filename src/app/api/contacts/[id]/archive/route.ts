import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Only owners can archive or restore contacts' }, { status: 403 });
    }

    const { action } = await req.json();
    const contactId = params.id;

    let contact;
    if (action === 'restore') {
      contact = db.contacts.restore(contactId, user.id, user.full_name);
    } else {
      contact = db.contacts.archive(contactId, user.id, user.full_name);
    }

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: action === 'restore' ? 'Contact restored successfully' : 'Contact archived successfully',
      contact,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
