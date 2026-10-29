import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const org = db.organizations.findFirst();
    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 500 });

    const isOwner = user.role === 'owner';

    // Scoped queue
    const contacts = db.contacts.findMany(
      org.id, 
      isOwner ? undefined : { agentId: user.id }
    ).filter(c => !c.do_not_call);

    return NextResponse.json({ contacts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
