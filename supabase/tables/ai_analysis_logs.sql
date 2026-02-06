CREATE TABLE ai_analysis_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID,
    analysis_type VARCHAR(50) NOT NULL,
    input_data JSONB,
    output_response TEXT,
    confidence_score DECIMAL(3,2),
    model_version VARCHAR(50) DEFAULT 'gpt-4-security-v1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);