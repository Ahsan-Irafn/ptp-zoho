import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { permissions } from '@/lib/auth/permissions';

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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { content } = await req.json();
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }

    const note = db.notes.create({
      id: `note_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: contact.organization_id,
      contact_id: contact.id,
      author_id: user.id,
      content: content.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, note });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
