import { useState, useEffect } from 'react';
import { Users, Shield, LogOut, Key, Trash2, UserPlus } from 'lucide-react';
import { 
  getUsersByRole, 
  assignUserRole, 
  createTeam, 
  addTeamMember, 
  getAuditLogs 
} from '@/lib/rbac';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'teams' | 'audit'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [selectedUserRole, setSelectedUserRole] = useState<'admin' | 'analyst' | 'responder' | 'viewer'>('analyst');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        // Load ALL users from database function
        const { data, error } = await supabase.rpc('get_users_with_roles');
        if (error) throw error;
        setUsers(data || []);
      } else if (activeTab === 'audit') {
        const logs = await getAuditLogs({ limit: 50 });
        setAuditLogs(logs);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRole = async (userId: string, role: string) => {
    if (!user?.id) return;
    
    try {
      const result = await assignUserRole(userId, role as any, user.id);
      if (result.success) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to assign role:', error);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    // Implementation here
  };

  return (
    <div className="space-y-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-semibold text-text-main">Admin Panel</h1>
        <div className="flex items-center gap-sm">
          <Shield size={20} className="text-cyber-primary" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-md border-b border-border-subtle">
        {(['users', 'teams', 'audit'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-md py-sm text-small font-medium transition-all ${
              activeTab === tab
                ? 'text-cyber-primary border-b-2 border-cyber-primary'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-lg">
          <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
            <div className="flex items-center gap-sm mb-md">
              <Users size={18} className="text-cyber-primary" />
              <h2 className="text-h2 font-medium text-text-main">User Management</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg-elevated text-small text-text-muted uppercase">
                    <th className="text-left p-sm">Email</th>
                    <th className="text-left p-sm">Role</th>
                    <th className="text-left p-sm">Created</th>
                    <th className="text-left p-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-small">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-md text-center text-text-muted">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map(u => (
                      <tr key={u.user_id} className="border-t border-border-subtle hover:bg-bg-elevated">
                        <td className="p-sm text-text-main">{u.email}</td>
                        <td className="p-sm">
                          <select
                            value={u.role || 'none'}
                            onChange={(e) => handleAssignRole(u.user_id, e.target.value)}
                            className="bg-bg-elevated border border-border-subtle rounded px-sm py-xs text-small"
                          >
                            <option value="none">No Role</option>
                            <option value="admin">Admin</option>
                            <option value="analyst">Analyst</option>
                            <option value="responder">Responder</option>
                            <option value="viewer">Viewer</option>
                            <option value="engineer">Engineer</option>
                          </select>
                        </td>
                        <td className="p-sm text-text-muted">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-sm">
                          <button className="text-status-critical hover:text-status-critical/80">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Teams Tab */}
      {activeTab === 'teams' && (
        <div className="space-y-lg">
          <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
            <div className="flex items-center gap-sm mb-md">
              <Users size={18} className="text-cyber-primary" />
              <h2 className="text-h2 font-medium text-text-main">Teams</h2>
            </div>
            <p className="text-text-muted text-small">Team management coming soon...</p>
          </div>
        </div>
      )}

      {/* Audit Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-lg">
          <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
            <div className="flex items-center gap-sm mb-md">
              <LogOut size={18} className="text-cyber-primary" />
              <h2 className="text-h2 font-medium text-text-main">Audit Logs</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg-elevated text-small text-text-muted uppercase">
                    <th className="text-left p-sm">User</th>
                    <th className="text-left p-sm">Action</th>
                    <th className="text-left p-sm">Resource</th>
                    <th className="text-left p-sm">Time</th>
                  </tr>
                </thead>
                <tbody className="text-small">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="border-t border-border-subtle">
                      <td className="p-sm text-cyber-primary font-mono">{log.user_id.slice(0, 12)}...</td>
                      <td className="p-sm text-text-main">{log.action}</td>
                      <td className="p-sm text-text-muted">{log.resource_id || '-'}</td>
                      <td className="p-sm text-text-muted">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
