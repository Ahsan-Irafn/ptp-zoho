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
      return NextResponse.json({ error: 'Forbidden: Only owners can reassign contacts' }, { status: 403 });
    }

    const { agentId } = await req.json();
    const contactId = params.id;

    const contact = db.contacts.reassign(
      contactId,
      agentId || null,
      user.id,
      user.full_name
    );

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: agentId ? 'Contact reassigned successfully' : 'Contact unassigned successfully',
      contact,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
