import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db, sanitizeRecordForRole } from '@/lib/db';
import { permissions } from '@/lib/auth/permissions';

export async function GET(
  req: NextRequest, 
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contact = db.contacts.findById(params.id);
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  // Verify permission: agents can ONLY access assigned contacts
  if (!permissions.canAccessContact(user.role, user.id, contact)) {
    return NextResponse.json({ error: 'Forbidden: Access denied to this record' }, { status: 403 });
  }

  const sanitized = sanitizeRecordForRole('contacts', contact, user.role);

  return NextResponse.json({ contact: sanitized });
}

export async function PATCH(
  req: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contact = db.contacts.findById(params.id);
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    if (!permissions.canAccessContact(user.role, user.id, contact)) {
      return NextResponse.json({ error: 'Forbidden: Access denied to this record' }, { status: 403 });
    }

    const updates = await req.json();

    // Reassignment check: only owners can change assigned agent
    if (updates.assigned_agent_id !== undefined && updates.assigned_agent_id !== contact.assigned_agent_id) {
      if (!permissions.canReassignContact(user.role)) {
        return NextResponse.json({ error: 'Only owners can reassign contacts' }, { status: 403 });
      }
    }

    // Custom field edit authorization
    if (updates.custom_fields && typeof updates.custom_fields === 'object') {
      const fieldDefs = db.fields.findMany(contact.organization_id, 'contacts');
      const mergedCustom = { ...(contact.custom_fields || {}) };

      for (const [key, val] of Object.entries(updates.custom_fields)) {
        const field = fieldDefs.find(f => f.field_key === key);
        if (field && user.role === 'agent' && field.is_owner_only_edit) {
          continue; // Calling agents cannot mutate owner-only edit fields
        }
        mergedCustom[key] = val;
      }
      updates.custom_fields = mergedCustom;
    }

    const updated = db.contacts.update(contact.id, updates);

    // Record audit event
    db.auditEvents.create({
      organization_id: contact.organization_id,
      actor_id: user.id,
      actor_name: user.full_name,
      action: 'contact_updated',
      target_type: 'contact',
      target_id: contact.id,
      details: updates,
    });

    const sanitized = sanitizeRecordForRole('contacts', updated, user.role);

    return NextResponse.json({ success: true, contact: sanitized });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
