import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { ModuleDefinition } from '@/types/crm';

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

    const modules = db.modules.findMany(org.id, {
      includeDisabled: user.role === 'owner',
      role: user.role,
    });

    return NextResponse.json({ success: true, modules });
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
      return NextResponse.json({ error: 'Forbidden: Only owners can create custom modules' }, { status: 403 });
    }

    const org = db.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, singular_name, key, description, icon, sidebar_position, agent_access, table_columns } = body;

    if (!name || !singular_name || !key) {
      return NextResponse.json({ error: 'Name, singular name, and key are required' }, { status: 400 });
    }

    // Key sanitization: strictly alphanumeric and underscores, no SQL or script execution
    const cleanKey = String(key).toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    if (!cleanKey) {
      return NextResponse.json({ error: 'Invalid module key' }, { status: 400 });
    }

    const newModule: ModuleDefinition = {
      id: `mod_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: org.id,
      key: cleanKey,
      name: String(name).trim(),
      singular_name: String(singular_name).trim(),
      description: description ? String(description).trim() : '',
      icon: icon || 'Building2',
      sidebar_position: Number(sidebar_position) || 10,
      is_enabled: true,
      is_system: false,
      agent_access: agent_access === 'all' || agent_access === 'assigned_only' ? agent_access : 'none',
      table_columns: Array.isArray(table_columns) ? table_columns : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const created = db.modules.create(newModule);

    return NextResponse.json({ success: true, module: created }, { status: 201 });
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
      return NextResponse.json({ error: 'Forbidden: Only owners can update modules' }, { status: 403 });
    }

    const org = db.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await req.json();
    const { key, ...updates } = body;

    if (!key) {
      return NextResponse.json({ error: 'Module key is required' }, { status: 400 });
    }

    const updated = db.modules.update(org.id, key, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, module: updated });
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
      return NextResponse.json({ error: 'Forbidden: Only owners can archive modules' }, { status: 403 });
    }

    const org = db.organizations.findFirst();
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'Module key parameter is required' }, { status: 400 });
    }

    const archived = db.modules.archive(org.id, key);
    if (!archived) {
      return NextResponse.json({ error: 'Module not found or cannot be archived' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Module '${key}' disabled successfully` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
