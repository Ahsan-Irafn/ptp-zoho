import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { permissions } from '@/lib/auth/permissions';
import { generateSecureToken } from '@/lib/utils/crypto';
import { Role } from '@/types/crm';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!permissions.canManageTeam(user.role)) {
      return NextResponse.json({ error: 'Forbidden: Only owners can manage team members' }, { status: 403 });
    }

    const { email, fullName, role } = await req.json();

    if (!email || !fullName) {
      return NextResponse.json({ error: 'Email and full name are required' }, { status: 400 });
    }

    const org = db.organizations.findFirst();
    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 500 });

    const existingProfile = db.profiles.findByEmail(email);
    if (existingProfile) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    const token = generateSecureToken(24);
    const invitation = db.invitations.create({
      id: `invite_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: org.id,
      email,
      full_name: fullName,
      role: (role as Role) || 'agent',
      token,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      invited_by: user.id,
      created_at: new Date().toISOString(),
    });

    // Create user profile in pending status
    const newProfile = db.profiles.create({
      id: `user_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: org.id,
      email,
      full_name: fullName,
      role: (role as Role) || 'agent',
      is_active: true,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Audit Log
    db.auditEvents.create({
      organization_id: org.id,
      actor_id: user.id,
      actor_name: user.full_name,
      action: 'team_member_invited',
      target_type: 'user',
      target_id: newProfile.id,
      details: { email, role, token },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteUrl = `${appUrl}/invite?token=${token}`;

    return NextResponse.json({
      success: true,
      invitation,
      profile: newProfile,
      inviteUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
