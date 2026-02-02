#!/bin/bash

# Create tables using Supabase REST API
curl "https://tjbnyurvlmbywxjlfunf.supabase.co/rest/v1/rpc/exec_sql" \
  -X POST \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqYm55dXJ2bG1ieXd4amxmdW5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxOTY0OSwiZXhwIjoyMDg1NDk1NjQ5fQ.4xaKVSWY6oUJtnn7BODtkC5G8gTanT50WOe1DmHTi5Y" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqYm55dXJ2bG1ieXd4amxmdW5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxOTY0OSwiZXhwIjoyMDg1NDk1NjQ5fQ.4xaKVSWY6oUJtnn7BODtkC5G8gTanT50WOe1DmHTi5Y" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CREATE TABLE IF NOT EXISTS ai_analysis_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), alert_id UUID, analysis_type VARCHAR(50) NOT NULL, input_data JSONB, output_response TEXT, confidence_score DECIMAL(3,2), model_version VARCHAR(50) DEFAULT '\''gpt-4-security-v1'\'', created_at TIMESTAMPTZ DEFAULT NOW()); CREATE TABLE IF NOT EXISTS network_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_type VARCHAR(50) NOT NULL, source_ip VARCHAR(45), destination_ip VARCHAR(45), protocol VARCHAR(20), bytes_transferred BIGINT, packets INTEGER, is_anomaly BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()); ALTER TABLE network_events ENABLE ROW LEVEL SECURITY; ALTER TABLE ai_analysis_logs ENABLE ROW LEVEL SECURITY; CREATE POLICY IF NOT EXISTS '\''Allow all for authenticated'\'' ON network_events FOR ALL TO authenticated USING (true); CREATE POLICY IF NOT EXISTS '\''Allow all for authenticated'\'' ON ai_analysis_logs FOR ALL TO authenticated USING (true);"
  }'
