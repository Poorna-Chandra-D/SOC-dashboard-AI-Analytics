-- Migration: enable_rls_and_policies
-- Created at: 1769922475

-- Enable RLS
ALTER TABLE threats ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow read for authenticated" ON threats;
DROP POLICY IF EXISTS "Allow read for authenticated" ON alerts;
DROP POLICY IF EXISTS "Allow read for authenticated" ON network_events;
DROP POLICY IF EXISTS "Allow read for authenticated" ON ai_analysis_logs;
DROP POLICY IF EXISTS "Allow update for authenticated" ON alerts;
DROP POLICY IF EXISTS "Allow all for authenticated" ON network_events;
DROP POLICY IF EXISTS "Allow all for authenticated" ON ai_analysis_logs;

-- Create policies for authenticated users
CREATE POLICY "Allow all for authenticated" ON threats FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON network_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON ai_analysis_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);