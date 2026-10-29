import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { FieldDefinition } from '@/types/crm';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = db.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const moduleKey = searchParams.get('moduleKey') || undefined;
    const includeArchived = searchParams.get('includeArchived') === 'true' && user.role === 'owner';

    const fields = db.fields.findMany(org.id, moduleKey, {
      includeArchived,
      role: user.role,
    });

    return NextResponse.json({ success: true, fields });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Only owners can manage custom fields' }, { status: 403 });
    }

    const org = db.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      module_key,
      field_key,
      label,
      field_type,
      help_text,
      placeholder,
      is_required,
      default_value,
      options,
      validation_rules,
      section,
      display_order,
      show_in_form,
      show_in_table,
      show_in_detail,
      is_owner_only_view,
      is_owner_only_edit,
    } = body;

    if (!module_key || !field_key || !label || !field_type) {
      return NextResponse.json(
        { error: 'Module key, internal field key, label, and field type are required' },
        { status: 400 }
      );
    }

    // Stable internal key: lowercase alphanumeric and underscores
    const cleanKey = String(field_key).toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    if (!cleanKey) {
      return NextResponse.json({ error: 'Invalid field key' }, { status: 400 });
    }

    const newField: FieldDefinition = {
      id: `fld_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: org.id,
      module_key: String(module_key).trim(),
      field_key: cleanKey,
      label: String(label).trim(),
      field_type,
      help_text: help_text ? String(help_text).trim() : undefined,
      placeholder: placeholder ? String(placeholder).trim() : undefined,
      is_required: Boolean(is_required),
      default_value: default_value !== undefined ? default_value : undefined,
      options: Array.isArray(options) ? options : undefined,
      validation_rules: validation_rules || undefined,
      section: section ? String(section).trim() : 'Additional Details',
      display_order: Number(display_order) || 10,
      show_in_form: show_in_form !== undefined ? Boolean(show_in_form) : true,
      show_in_table: Boolean(show_in_table),
      show_in_detail: show_in_detail !== undefined ? Boolean(show_in_detail) : true,
      is_owner_only_view: Boolean(is_owner_only_view),
      is_owner_only_edit: Boolean(is_owner_only_edit),
      is_system: false,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const created = db.fields.create(newField);

    return NextResponse.json({ success: true, field: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Only owners can update custom fields' }, { status: 403 });
    }

    const org = db.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Field ID is required' }, { status: 400 });
    }

    const updated = db.fields.update(org.id, id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, field: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Only owners can archive custom fields' }, { status: 403 });
    }

    const org = db.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Field ID parameter is required' }, { status: 400 });
    }

    const field = db.fields.findById(id);
    if (!field) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    // Check dependencies before archiving
    const dependencies = db.fields.checkDependencies(org.id, field.module_key, field.field_key);

    const archived = db.fields.archive(org.id, id);
    if (!archived) {
      return NextResponse.json({ error: 'Failed to archive field' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Field '${field.label}' archived successfully. Historical data preserved.`,
      dependencies,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
