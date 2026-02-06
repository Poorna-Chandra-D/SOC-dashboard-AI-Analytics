-- Create incident_responses table for tracking automated actions
CREATE TABLE IF NOT EXISTS incident_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  target TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  result TEXT,
  executed_by UUID,
  executed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(alert_id, action, target)
);

-- Create audit_logs table for compliance
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_id VARCHAR(255),
  status VARCHAR(20),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Create user_roles table for RBAC
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL DEFAULT 'analyst',
  organization_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'analyst', 'viewer', 'responder', 'engineer'))
);

-- Create roles_permissions table
CREATE TABLE IF NOT EXISTS roles_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role, permission)
);

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  organization_id UUID,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Insert default roles and permissions
INSERT INTO roles_permissions (role, permission) VALUES
-- Admin permissions
('admin', 'view_all_alerts'),
('admin', 'manage_users'),
('admin', 'execute_response'),
('admin', 'manage_rules'),
('admin', 'manage_teams'),
('admin', 'view_audit_logs'),
('admin', 'system_settings'),

-- Analyst permissions
('analyst', 'view_all_alerts'),
('analyst', 'execute_response'),
('analyst', 'create_playbooks'),
('analyst', 'view_audit_logs'),
('analyst', 'assign_alerts'),

-- Responder permissions
('responder', 'view_assigned_alerts'),
('responder', 'execute_response'),
('responder', 'update_alert_status'),

-- Viewer permissions
('viewer', 'view_all_alerts'),
('viewer', 'view_dashboard'),

-- Engineer permissions
('engineer', 'manage_rules'),
('engineer', 'manage_integrations'),
('engineer', 'system_settings')
ON CONFLICT DO NOTHING;

-- Enable RLS on new tables
ALTER TABLE incident_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own incident responses" ON incident_responses
  FOR SELECT USING (executed_by = auth.uid());

CREATE POLICY "Admins can view all incident responses" ON incident_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can view own audit logs" ON audit_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view their own role" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
