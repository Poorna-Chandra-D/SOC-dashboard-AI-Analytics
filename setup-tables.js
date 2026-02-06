import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tjbnyurvlmbywxjlfunf.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqYm55dXJ2bG1ieXd4amxmdW5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxOTY0OSwiZXhwIjoyMDg1NDk1NjQ5fQ.4xaKVSWY6oUJtnn7BODtkC5G8gTanT50WOe1DmHTi5Y';

const supabase = createClient(supabaseUrl, serviceRoleKey);

const sql = `
-- Create ai_analysis_logs table
CREATE TABLE IF NOT EXISTS ai_analysis_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID,
    analysis_type VARCHAR(50) NOT NULL,
    input_data JSONB,
    output_response TEXT,
    confidence_score DECIMAL(3,2),
    model_version VARCHAR(50) DEFAULT 'gpt-4-security-v1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create network_events table
CREATE TABLE IF NOT EXISTS network_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    source_ip VARCHAR(45),
    destination_ip VARCHAR(45),
    protocol VARCHAR(20),
    bytes_transferred BIGINT,
    packets INTEGER,
    is_anomaly BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE network_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all for authenticated" ON network_events;
DROP POLICY IF EXISTS "Allow all for authenticated" ON ai_analysis_logs;
DROP POLICY IF EXISTS "Allow read for authenticated" ON network_events;
DROP POLICY IF EXISTS "Allow read for authenticated" ON ai_analysis_logs;

-- Create policies
CREATE POLICY "Allow all for authenticated" ON network_events 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
    
CREATE POLICY "Allow all for authenticated" ON ai_analysis_logs 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
`;

const { data, error } = await supabase.rpc('exec_sql', { sql });

if (error) {
  console.error('Error creating tables:', error);
  process.exit(1);
}

console.log('✅ Tables created successfully!');
console.log('You can now refresh your dashboard.');
