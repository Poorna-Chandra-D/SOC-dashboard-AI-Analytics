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
