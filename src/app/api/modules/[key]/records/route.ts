import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db, sanitizeRecordForRole } from '@/lib/db';
import { CustomRecord } from '@/types/crm';

export async function GET(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = db.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const moduleKey = params.key;
    const mod = db.modules.findByKey(org.id, moduleKey);
    if (!mod || (!mod.is_enabled && user.role !== 'owner')) {
      return NextResponse.json({ error: 'Module not found or disabled' }, { status: 404 });
    }

    // Permission check for agents
    if (user.role === 'agent' && mod.agent_access === 'none') {
      return NextResponse.json({ error: 'Forbidden: Access to this module is owner-only' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const isArchived = searchParams.get('archived') === 'true';

    const agentId = user.role === 'agent' && mod.agent_access === 'assigned_only' ? user.id : undefined;

    const rawRecords = db.customRecords.findMany(org.id, moduleKey, {
      agentId,
      isArchived,
      search,
    });

    const fieldDefs = db.fields.findMany(org.id, moduleKey);

    const records = rawRecords.map(r => sanitizeRecordForRole(moduleKey, r, user.role, fieldDefs));

    return NextResponse.json({ success: true, records, module: mod });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = db.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const moduleKey = params.key;
    const mod = db.modules.findByKey(org.id, moduleKey);
    if (!mod || !mod.is_enabled) {
      return NextResponse.json({ error: 'Module not found or disabled' }, { status: 404 });
    }

    if (user.role === 'agent' && mod.agent_access === 'none') {
      return NextResponse.json({ error: 'Forbidden: Owner only access' }, { status: 403 });
    }

    const body = await req.json();
    const { title, assigned_agent_id, data: recordData } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title / identifier is required' }, { status: 400 });
    }

    const fieldDefs = db.fields.findMany(org.id, moduleKey);
    const validatedData: Record<string, any> = {};

    // Validate fields according to field definitions
    for (const field of fieldDefs) {
      // Disallow agents from editing owner-only edit fields
      if (user.role === 'agent' && field.is_owner_only_edit) {
        continue;
      }

      const val = recordData ? recordData[field.field_key] : undefined;
      const validation = db.fields.validateFieldValue(field, val);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      if (val !== undefined) {
        validatedData[field.field_key] = val;
      } else if (field.default_value !== undefined) {
        validatedData[field.field_key] = field.default_value;
      }
    }

    const newRecord: CustomRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: org.id,
      module_key: moduleKey,
      title: String(title).trim(),
      assigned_agent_id: assigned_agent_id || (user.role === 'agent' ? user.id : undefined),
      data: validatedData,
      is_archived: false,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const created = db.customRecords.create(newRecord);

    return NextResponse.json({
      success: true,
      record: sanitizeRecordForRole(moduleKey, created, user.role, fieldDefs),
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = db.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const moduleKey = params.key;
    const mod = db.modules.findByKey(org.id, moduleKey);
    if (!mod || !mod.is_enabled) {
      return NextResponse.json({ error: 'Module not found or disabled' }, { status: 404 });
    }

    if (user.role === 'agent' && mod.agent_access === 'none') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { id, title, assigned_agent_id, data: recordData, is_archived } = body;

    if (!id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
    }

    const existing = db.customRecords.findById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Agent boundary check
    if (user.role === 'agent' && mod.agent_access === 'assigned_only' && existing.assigned_agent_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: Cannot edit another agent\'s record' }, { status: 403 });
    }

    const fieldDefs = db.fields.findMany(org.id, moduleKey);
    const updates: Partial<CustomRecord> = {};

    if (title !== undefined) updates.title = String(title).trim();
    if (user.role === 'owner' && assigned_agent_id !== undefined) {
      updates.assigned_agent_id = assigned_agent_id || undefined;
    }
    if (user.role === 'owner' && is_archived !== undefined) {
      updates.is_archived = Boolean(is_archived);
    }

    if (recordData) {
      const mergedData = { ...existing.data };
      for (const field of fieldDefs) {
        if (user.role === 'agent' && field.is_owner_only_edit) {
          continue; // Agent cannot alter owner-only edit fields
        }
        if (recordData[field.field_key] !== undefined) {
          const val = recordData[field.field_key];
          const validation = db.fields.validateFieldValue(field, val);
          if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
          }
          mergedData[field.field_key] = val;
        }
      }
      updates.data = mergedData;
    }

    const updated = db.customRecords.update(id, updates);

    return NextResponse.json({
      success: true,
      record: sanitizeRecordForRole(moduleKey, updated, user.role, fieldDefs),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
