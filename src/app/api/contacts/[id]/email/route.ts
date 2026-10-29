import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { permissions } from '@/lib/auth/permissions';
import { EmailService } from '@/lib/services/email-service';

export async function POST(
  req: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contact = db.contacts.findById(params.id);
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    if (!permissions.canSendApprovedEmail(user.role, user.id, contact)) {
      return NextResponse.json({ 
        error: 'Forbidden: Cannot send email to this contact (unassigned or suppressed)' 
      }, { status: 403 });
    }

    const { templateSlug, customSubject, customBody } = await req.json();

    const result = await EmailService.sendEmail({
      organizationId: contact.organization_id,
      contactId: contact.id,
      recipientEmail: contact.email,
      templateSlug,
      customSubject,
      customBody,
      agentName: user.full_name,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error, status: result.status }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      status: result.status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
