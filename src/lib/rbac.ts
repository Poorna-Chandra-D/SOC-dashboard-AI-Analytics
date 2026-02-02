import { supabase } from './supabase';

export type UserRole = 'admin' | 'analyst' | 'responder' | 'viewer' | 'engineer';

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TeamRecord {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Get user's role
export async function getUserRole(userId: string): Promise<UserRole | null> {
  try {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    return data?.role || null;
  } catch (error) {
    console.error('Failed to get user role:', error);
    return null;
  }
}

// Check if user has permission
export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  try {
    const role = await getUserRole(userId);
    if (!role) return false;

    const { data } = await supabase
      .from('roles_permissions')
      .select('permission')
      .eq('role', role)
      .eq('permission', permission)
      .maybeSingle();

    return !!data;
  } catch (error) {
    console.error('Failed to check permission:', error);
    return false;
  }
}

// Get all permissions for a role
export async function getRolePermissions(role: UserRole): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('roles_permissions')
      .select('permission')
      .eq('role', role);

    return data?.map(p => p.permission) || [];
  } catch (error) {
    console.error('Failed to get role permissions:', error);
    return [];
  }
}

// Assign role to user
export async function assignUserRole(
  userId: string,
  role: UserRole,
  executedBy: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Check if executor has admin rights
    const executorRole = await getUserRole(executedBy);
    if (executorRole !== 'admin') {
      return { success: false, message: 'Only admins can assign roles' };
    }

    const { error } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;

    // Log action
    await supabase.from('audit_logs').insert({
      user_id: executedBy,
      action: `Assigned role ${role} to user ${userId}`,
      resource_id: userId,
      status: 'success',
      created_at: new Date().toISOString(),
    });

    return { success: true, message: `User assigned role: ${role}` };
  } catch (error) {
    console.error('Failed to assign role:', error);
    return { success: false, message: `Error: ${error}` };
  }
}

// Create team
export async function createTeam(
  name: string,
  description: string | undefined,
  createdBy: string
): Promise<{ success: boolean; teamId?: string; message: string }> {
  try {
    // Check if creator has admin rights
    const creatorRole = await getUserRole(createdBy);
    if (creatorRole !== 'admin' && creatorRole !== 'analyst') {
      return { success: false, message: 'Only admins and analysts can create teams' };
    }

    const { data, error } = await supabase
      .from('teams')
      .insert({
        name,
        description,
        created_by: createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Add creator to team
    await addTeamMember(data.id, createdBy, 'lead');

    return { success: true, teamId: data.id, message: 'Team created successfully' };
  } catch (error) {
    console.error('Failed to create team:', error);
    return { success: false, message: `Error: ${error}` };
  }
}

// Add team member
export async function addTeamMember(
  teamId: string,
  userId: string,
  role: string = 'member'
): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
        role,
        joined_at: new Date().toISOString(),
      });

    if (error) throw error;

    return { success: true, message: 'User added to team' };
  } catch (error) {
    console.error('Failed to add team member:', error);
    return { success: false, message: `Error: ${error}` };
  }
}

// Get user's teams
export async function getUserTeams(userId: string): Promise<TeamRecord[]> {
  try {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .in(
        'id',
        supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', userId)
      );

    return data || [];
  } catch (error) {
    console.error('Failed to get user teams:', error);
    return [];
  }
}

// Get team members
export async function getTeamMembers(teamId: string) {
  try {
    const { data } = await supabase
      .from('team_members')
      .select('user_id, role, joined_at')
      .eq('team_id', teamId);

    return data || [];
  } catch (error) {
    console.error('Failed to get team members:', error);
    return [];
  }
}

// Get audit logs
export async function getAuditLogs(filters?: {
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  try {
    let query = supabase.from('audit_logs').select('*');

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters?.action) {
      query = query.ilike('action', `%${filters.action}%`);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data } = await query
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 100);

    return data || [];
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return [];
  }
}

// Log user action
export async function logAction(
  userId: string,
  action: string,
  resourceId?: string,
  details?: any
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      resource_id: resourceId,
      status: 'success',
      details,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log action:', error);
  }
}

// Check if user can perform action on alert
export async function canUserAccessAlert(
  userId: string,
  alertId: string
): Promise<boolean> {
  try {
    const role = await getUserRole(userId);

    // Admins can access all alerts
    if (role === 'admin') return true;

    // Analysts can access all alerts
    if (role === 'analyst') return true;

    // Responders can only access assigned alerts
    if (role === 'responder') {
      const { data } = await supabase
        .from('alerts')
        .select('id')
        .eq('id', alertId)
        // Check assignment in your alerts table
        .maybeSingle();

      return !!data;
    }

    // Viewers can view all but not modify
    if (role === 'viewer') return true;

    return false;
  } catch (error) {
    console.error('Failed to check access:', error);
    return false;
  }
}

// Get users with specific role
export async function getUsersByRole(role: UserRole): Promise<any[]> {
  try {
    // Use database function to get users with emails
    const { data, error } = await supabase
      .rpc('get_users_with_roles');

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Filter by role client-side (or modify the function to accept role parameter)
    return data.filter((u: any) => u.role === role);
  } catch (error) {
    console.error('Failed to get users by role:', error);
    return [];
  }
}
