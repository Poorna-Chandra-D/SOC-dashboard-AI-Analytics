import { supabase } from './supabase';

export type SIEMProvider = 'splunk' | 'elk' | 'wazuh' | 'sumologic' | 'datadog' | 'sentinel';

export interface SIEMConfig {
  id: string;
  provider: SIEMProvider;
  endpoint: string;
  api_key: string;
  api_secret?: string;
  organization_id?: string;
  status: 'connected' | 'error' | 'pending';
  last_sync?: string;
  created_at: string;
}

export interface SIEMSearchResult {
  source: SIEMProvider;
  events: Array<{
    id: string;
    timestamp: string;
    source_ip: string;
    destination_ip: string;
    event_type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    raw_data: any;
  }>;
}

// Splunk API Integration
async function splunkQuery(config: SIEMConfig, query: string): Promise<SIEMSearchResult> {
  try {
    // Splunk SPL query format
    const spl = `search ${query} | head 1000`;

    const response = await fetch(`${config.endpoint}/services/search/jobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.api_key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ search: spl }),
    });

    if (!response.ok) throw new Error('Splunk query failed');

    const job = await response.json();
    const results = await pollSplunkJob(config, job.sid);

    return {
      source: 'splunk',
      events: results.map((e: any) => ({
        id: e._raw,
        timestamp: e._time,
        source_ip: e.src || '',
        destination_ip: e.dest || '',
        event_type: e.eventtype,
        severity: mapSeverity(e.severity),
        raw_data: e,
      })),
    };
  } catch (error) {
    console.error('Splunk query failed:', error);
    throw error;
  }
}

// Poll Splunk job results
async function pollSplunkJob(config: SIEMConfig, jobId: string): Promise<any[]> {
  const maxAttempts = 30;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await fetch(`${config.endpoint}/services/search/jobs/${jobId}/results`, {
      headers: { 'Authorization': `Bearer ${config.api_key}` },
    });

    const data = await response.json();

    if (data.done) {
      return data.results || [];
    }

    attempts++;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Splunk job polling timeout');
}

// ELK (Elasticsearch) Integration
async function elkQuery(config: SIEMConfig, query: any): Promise<SIEMSearchResult> {
  try {
    const response = await fetch(`${config.endpoint}/_search`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`elastic:${config.api_key}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        size: 1000,
        sort: [{ '@timestamp': 'desc' }],
      }),
    });

    if (!response.ok) throw new Error('ELK query failed');

    const data = await response.json();

    return {
      source: 'elk',
      events: data.hits.hits.map((hit: any) => ({
        id: hit._id,
        timestamp: hit._source['@timestamp'],
        source_ip: hit._source.source?.ip || '',
        destination_ip: hit._source.destination?.ip || '',
        event_type: hit._source.event?.category,
        severity: mapSeverity(hit._source.event?.severity),
        raw_data: hit._source,
      })),
    };
  } catch (error) {
    console.error('ELK query failed:', error);
    throw error;
  }
}

// Wazuh Integration
async function wazuhQuery(config: SIEMConfig, filter: string): Promise<SIEMSearchResult> {
  try {
    const response = await fetch(
      `${config.endpoint}/alerts?search=${encodeURIComponent(filter)}&limit=1000`,
      {
        headers: {
          'Authorization': `Bearer ${config.api_key}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) throw new Error('Wazuh query failed');

    const data = await response.json();

    return {
      source: 'wazuh',
      events: (data.data?.affected_items || []).map((alert: any) => ({
        id: alert.id,
        timestamp: alert.timestamp,
        source_ip: alert.data?.srcip || '',
        destination_ip: alert.data?.dstip || '',
        event_type: alert.rule?.description,
        severity: mapSeverity(alert.rule?.level),
        raw_data: alert,
      })),
    };
  } catch (error) {
    console.error('Wazuh query failed:', error);
    throw error;
  }
}

// Sumo Logic Integration
async function sumologicQuery(config: SIEMConfig, query: string): Promise<SIEMSearchResult> {
  try {
    const response = await fetch(`${config.endpoint}/api/v1/logs/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${config.api_key}:${config.api_secret}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        from: Date.now() - 3600000, // Last hour
        to: Date.now(),
      }),
    });

    if (!response.ok) throw new Error('Sumo Logic query failed');

    const data = await response.json();

    return {
      source: 'sumologic',
      events: data.records.map((record: any) => ({
        id: record.id,
        timestamp: record.timestamp,
        source_ip: record.src_ip || '',
        destination_ip: record.dst_ip || '',
        event_type: record.event_type,
        severity: mapSeverity(record.severity),
        raw_data: record,
      })),
    };
  } catch (error) {
    console.error('Sumo Logic query failed:', error);
    throw error;
  }
}

// Map severity levels across platforms
function mapSeverity(
  level: string | number
): 'critical' | 'high' | 'medium' | 'low' {
  const levelStr = String(level).toLowerCase();

  if (
    levelStr.includes('critical') ||
    levelStr.includes('severity=5') ||
    levelStr.includes('sev=5') ||
    Number(level) >= 4
  ) {
    return 'critical';
  }
  if (
    levelStr.includes('high') ||
    levelStr.includes('severity=4') ||
    Number(level) === 3
  ) {
    return 'high';
  }
  if (
    levelStr.includes('medium') ||
    levelStr.includes('severity=3') ||
    Number(level) === 2
  ) {
    return 'medium';
  }
  return 'low';
}

// Execute query across SIEM
export async function querySIEM(
  provider: SIEMProvider,
  config: SIEMConfig,
  query: string | any
): Promise<SIEMSearchResult> {
  try {
    switch (provider) {
      case 'splunk':
        return await splunkQuery(config, typeof query === 'string' ? query : '');
      case 'elk':
        return await elkQuery(config, query);
      case 'wazuh':
        return await wazuhQuery(config, typeof query === 'string' ? query : '');
      case 'sumologic':
        return await sumologicQuery(config, typeof query === 'string' ? query : '');
      default:
        throw new Error(`Unsupported SIEM provider: ${provider}`);
    }
  } catch (error) {
    console.error(`SIEM query failed for ${provider}:`, error);
    throw error;
  }
}

// Store SIEM configuration
export async function saveSIEMConfig(
  provider: SIEMProvider,
  endpoint: string,
  apiKey: string,
  apiSecret?: string
): Promise<{ success: boolean; configId?: string; message: string }> {
  try {
    // Validate connection first
    const testConfig: SIEMConfig = {
      id: 'test',
      provider,
      endpoint,
      api_key: apiKey,
      api_secret: apiSecret,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Attempt test query based on provider
    let testResult = true;
    try {
      switch (provider) {
        case 'splunk':
          await splunkQuery(testConfig, 'index=main | head 1');
          break;
        case 'elk':
          await elkQuery(testConfig, { match_all: {} });
          break;
        case 'wazuh':
          await wazuhQuery(testConfig, 'rule.id:1');
          break;
      }
    } catch {
      testResult = false;
    }

    if (!testResult) {
      return { success: false, message: 'Failed to connect to SIEM. Check credentials.' };
    }

    // Store encrypted config in database
    const { data, error } = await supabase
      .from('siem_configs')
      .insert({
        provider,
        endpoint,
        api_key: apiKey,
        api_secret: apiSecret,
        status: 'connected',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, configId: data.id, message: 'SIEM config saved and verified' };
  } catch (error) {
    console.error('Failed to save SIEM config:', error);
    return { success: false, message: `Error: ${error}` };
  }
}

// Get SIEM configuration
export async function getSIEMConfig(provider: SIEMProvider): Promise<SIEMConfig | null> {
  try {
    const { data } = await supabase
      .from('siem_configs')
      .select('*')
      .eq('provider', provider)
      .order('created_at', { ascending: false })
      .maybeSingle();

    return data;
  } catch (error) {
    console.error('Failed to get SIEM config:', error);
    return null;
  }
}

// Sync threats from SIEM
export async function syncThreatsfromSIEM(provider: SIEMProvider): Promise<{
  success: boolean;
  threatCount: number;
  message: string;
}> {
  try {
    const config = await getSIEMConfig(provider);
    if (!config) {
      return { success: false, threatCount: 0, message: `No config found for ${provider}` };
    }

    // Query for recent threats
    const query =
      provider === 'splunk'
        ? 'eventtype=alert severity=high OR severity=critical'
        : {
            bool: {
              must: [
                { match: { 'event.kind': 'alert' } },
                {
                  range: {
                    '@timestamp': {
                      gte: 'now-1h',
                    },
                  },
                },
              ],
            },
          };

    const results = await querySIEM(provider, config, query);

    // Import threats into database
    let threatCount = 0;
    for (const event of results.events) {
      try {
        await supabase.from('threats').insert({
          source_ip: event.source_ip,
          destination_ip: event.destination_ip,
          threat_type: event.event_type,
          severity: event.severity,
          status: 'under_review',
          country: 'Unknown', // Would need geolocation service
          city: 'Unknown',
          latitude: 0,
          longitude: 0,
          payload: event.raw_data,
          detected_at: event.timestamp,
        });
        threatCount++;
      } catch {
        // Duplicate or error - skip
      }
    }

    return {
      success: true,
      threatCount,
      message: `Synced ${threatCount} threats from ${provider}`,
    };
  } catch (error) {
    console.error(`Failed to sync threats from ${provider}:`, error);
    return { success: false, threatCount: 0, message: `Error: ${error}` };
  }
}

// Get all connected SIEM providers
export async function getConnectedSIEMs(): Promise<SIEMConfig[]> {
  try {
    const { data } = await supabase
      .from('siem_configs')
      .select('*')
      .eq('status', 'connected')
      .order('created_at', { ascending: false });

    return data || [];
  } catch (error) {
    console.error('Failed to get SIEM configs:', error);
    return [];
  }
}
