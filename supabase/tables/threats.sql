CREATE TABLE threats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_ip VARCHAR(45) NOT NULL,
    destination_ip VARCHAR(45),
    threat_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical',
    'high',
    'medium',
    'low')),
    country VARCHAR(100),
    city VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);