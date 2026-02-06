-- ============================================================
-- SOC Dashboard - Complete Migration Script
-- Run this in your Supabase SQL Editor
-- https://app.supabase.com/project/YOUR_PROJECT/sql/new
-- ============================================================

-- ============================================================
-- PART 1: RBAC AND RESPONSE TRACKING TABLES
-- ============================================================

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

-- ============================================================
-- PART 2: SIEM INTEGRATIONS
-- ============================================================

-- Create SIEM configurations table
CREATE TABLE IF NOT EXISTS siem_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  endpoint TEXT NOT NULL,
  api_key TEXT NOT NULL,
  api_secret TEXT,
  organization_id UUID,
  status VARCHAR(20) DEFAULT 'pending',
  last_sync TIMESTAMP,
  sync_count INTEGER DEFAULT 0,
  error_log TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  UNIQUE(provider, organization_id),
  CONSTRAINT valid_provider CHECK (provider IN ('splunk', 'elk', 'wazuh', 'sumologic', 'datadog', 'sentinel'))
);

-- Create external integrations table
CREATE TABLE IF NOT EXISTS external_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  integration_type VARCHAR(100) NOT NULL,
  endpoint TEXT NOT NULL,
  api_key TEXT NOT NULL,
  config JSONB,
  status VARCHAR(20) DEFAULT 'active',
  organization_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT valid_type CHECK (integration_type IN ('siem', 'ticketing', 'messaging', 'threat_intel', 'edr', 'other'))
);

-- Enable RLS
ALTER TABLE siem_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view SIEM configs" ON siem_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'analyst', 'engineer')
    )
  );

CREATE POLICY "Admins can manage SIEM configs" ON siem_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Engineers can manage integrations" ON external_integrations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'engineer')
    )
  );

-- ============================================================
-- PART 3: FIX EXISTING TABLES
-- ============================================================

-- Add missing columns to threats table
ALTER TABLE threats ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE threats ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ DEFAULT NOW();

-- Add missing columns to alerts table
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source VARCHAR(45);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS recommended_action TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ DEFAULT NOW();

-- Add missing columns to network_events table
ALTER TABLE network_events ADD COLUMN IF NOT EXISTS severity VARCHAR(20);
ALTER TABLE network_events ADD COLUMN IF NOT EXISTS action VARCHAR(20);
ALTER TABLE network_events ADD COLUMN IF NOT EXISTS port INTEGER;
ALTER TABLE network_events ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- PART 4: CREATE INDEXES FOR PERFORMANCE
-- ============================================================

-- Threats indexes
CREATE INDEX IF NOT EXISTS idx_threats_severity ON threats(severity);
CREATE INDEX IF NOT EXISTS idx_threats_status ON threats(status);
CREATE INDEX IF NOT EXISTS idx_threats_source_ip ON threats(source_ip);
CREATE INDEX IF NOT EXISTS idx_threats_detected_at ON threats(detected_at DESC);

-- Alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_threat_id ON alerts(threat_id);
CREATE INDEX IF NOT EXISTS idx_alerts_detected_at ON alerts(detected_at DESC);

-- Network events indexes
CREATE INDEX IF NOT EXISTS idx_network_events_source_ip ON network_events(source_ip);
CREATE INDEX IF NOT EXISTS idx_network_events_event_type ON network_events(event_type);
CREATE INDEX IF NOT EXISTS idx_network_events_detected_at ON network_events(detected_at DESC);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================
-- PART 5: VERIFY INSTALLATION
-- ============================================================

-- Check created tables
SELECT 
  table_name,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('threats', 'alerts', 'network_events', 'ai_analysis_logs', 
                   'incident_responses', 'user_roles', 'roles_permissions', 
                   'teams', 'team_members', 'audit_logs', 'siem_configs', 
                   'external_integrations')
ORDER BY table_name;

-- ✅ If you see all 12 tables, the migration was successful!
