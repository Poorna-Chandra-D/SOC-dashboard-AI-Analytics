CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threat_id UUID,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical',
    'high',
    'medium',
    'low')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open',
    'investigating',
    'resolved',
    'dismissed')),
    ai_analysis TEXT,
    recommended_action TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);