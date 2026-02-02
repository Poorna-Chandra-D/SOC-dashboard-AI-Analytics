import { supabase } from './supabase';

export type ThreatSource = 'netflow' | 'ids' | 'firewall' | 'honeypot' | 'siem';

interface RawThreatData {
  source_ip: string;
  destination_ip: string;
  threat_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  payload?: Record<string, unknown>;
  detected_at: string;
  source: ThreatSource;
}

// Mock threat data generator (simulates real threat sources)
function generateMockThreats(): RawThreatData[] {
  const threatTypes = [
    'Brute Force SSH',
    'SQL Injection Attempt',
    'DDoS Attack',
    'Port Scanning',
    'Malware C2 Communication',
    'Data Exfiltration',
    'Privilege Escalation',
    'Lateral Movement',
  ];

  const countries = [
    { name: 'Russia', cities: ['Moscow', 'St. Petersburg'], lat: 55.75, lon: 37.62 },
    { name: 'China', cities: ['Beijing', 'Shanghai'], lat: 39.9, lon: 116.41 },
    { name: 'North Korea', cities: ['Pyongyang'], lat: 39.02, lon: 125.75 },
    { name: 'Iran', cities: ['Tehran'], lat: 35.69, lon: 51.39 },
    { name: 'USA', cities: ['New York', 'Los Angeles'], lat: 40.71, lon: -74.01 },
  ];

  const severities: Array<'critical' | 'high' | 'medium' | 'low'> = [
    'critical',
    'critical',
    'high',
    'high',
    'medium',
    'low',
  ];

  const threats: RawThreatData[] = [];
  const count = Math.floor(Math.random() * 5) + 3; // 3-8 threats

  for (let i = 0; i < count; i++) {
    const country = countries[Math.floor(Math.random() * countries.length)];
    const city = country.cities[Math.floor(Math.random() * country.cities.length)];

    threats.push({
      source_ip: `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
      destination_ip: `10.0.0.${Math.floor(Math.random() * 254) + 1}`,
      threat_type: threatTypes[Math.floor(Math.random() * threatTypes.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      country: country.name,
      city,
      latitude: country.lat + (Math.random() - 0.5) * 10,
      longitude: country.lon + (Math.random() - 0.5) * 10,
      payload: {
        packets: Math.floor(Math.random() * 10000),
        bytes: Math.floor(Math.random() * 1000000),
        protocol: ['TCP', 'UDP', 'ICMP'][Math.floor(Math.random() * 3)],
      },
      detected_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      source: ['netflow', 'ids', 'firewall', 'honeypot'][Math.floor(Math.random() * 4)] as ThreatSource,
    });
  }

  return threats;
}

// Ingest threats from various sources
export async function ingestThreatsFromSources() {
  try {
    const rawThreats = generateMockThreats();

    // Check for duplicates before inserting
    for (const threat of rawThreats) {
      const { data: existing } = await supabase
        .from('threats')
        .select('id')
        .eq('source_ip', threat.source_ip)
        .eq('destination_ip', threat.destination_ip)
        .eq('detected_at', threat.detected_at)
        .maybeSingle();

      if (!existing) {
        await supabase.from('threats').insert({
          source_ip: threat.source_ip,
          destination_ip: threat.destination_ip,
          country: threat.country,
          city: threat.city,
          latitude: threat.latitude,
          longitude: threat.longitude,
          threat_type: threat.threat_type,
          severity: threat.severity,
          status: threat.severity === 'critical' ? 'active' : 'under_review',
          payload: threat.payload,
          detected_at: threat.detected_at,
        });
      }
    }

    return { success: true, count: rawThreats.length };
  } catch (error) {
    console.error('Failed to ingest threats:', error);
    throw error;
  }
}

// Create alerts from threats
export async function generateAlertsFromThreats() {
  try {
    const { data: unprocessedThreats } = await supabase
      .from('threats')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(50);

    if (!unprocessedThreats) return { success: false };

    for (const threat of unprocessedThreats) {
      // Check if alert already exists for this threat
      const { data: existingAlert } = await supabase
        .from('alerts')
        .select('id')
        .eq('threat_id', threat.id)
        .maybeSingle();

      if (!existingAlert) {
        const aiSummary = generateAISummary(threat);
        const recommendedAction = generateRecommendedAction(threat);

        await supabase.from('alerts').insert({
          threat_id: threat.id,
          title: `${threat.threat_type}: ${threat.source_ip}`,
          description: `Detected ${threat.threat_type} from ${threat.country} targeting ${threat.destination_ip}`,
          severity: threat.severity,
          status: threat.severity === 'critical' ? 'active' : 'investigating',
          source: threat.source_ip,
          ai_summary: aiSummary,
          recommended_action: recommendedAction,
          created_at: threat.detected_at,
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to generate alerts:', error);
    throw error;
  }
}

function generateAISummary(threat: any): string {
  const summaries: Record<string, string> = {
    'Brute Force SSH': 'Multiple failed SSH authentication attempts detected. Pattern suggests distributed attack across multiple source IPs attempting common credentials.',
    'SQL Injection Attempt': 'Malicious SQL payload detected in HTTP request parameters. Indicates sophisticated attack targeting database layer. IDS signature matched known SQLMap tool usage.',
    'DDoS Attack': 'High volume traffic spike detected from multiple geographic locations. Volumetric attack pattern consistent with UDP flood. Botnet infrastructure suspected.',
    'Port Scanning': 'Sequential port scanning activity detected. Reconnaissance phase of potential network compromise. All destination ports in range 20-1024 probed.',
    'Malware C2 Communication': 'Outbound connection to known C2 infrastructure detected. Network behavior matches known botnet communication pattern. Immediate containment recommended.',
    'Data Exfiltration': 'Large outbound data transfer detected. Connection to non-approved external IP with suspicious protocol behavior. Potential corporate data theft.',
    'Privilege Escalation': 'Suspicious process behavior detected attempting to gain elevated privileges. Windows security events indicate exploitation attempt.',
    'Lateral Movement': 'Network traffic between internal systems with suspicious characteristics. Suggests attacker moving within network after initial compromise.',
  };

  return summaries[threat.threat_type] || `Threat analysis for ${threat.threat_type} detected from ${threat.country}.`;
}

function generateRecommendedAction(threat: any): string {
  const actions: Record<string, string> = {
    'Brute Force SSH': '1. Enable rate limiting on SSH port\n2. Implement IP-based access controls\n3. Review failed login attempts\n4. Enforce strong password policy\n5. Consider disabling SSH password auth',
    'SQL Injection Attempt': '1. Block source IP immediately\n2. Scan database for injection payloads\n3. Review and patch vulnerable input validation\n4. Check database access logs\n5. Update WAF rules',
    'DDoS Attack': '1. Activate DDoS mitigation rules\n2. Increase bandwidth capacity\n3. Blackhole traffic from attacking IPs\n4. Contact ISP for upstream filtering\n5. Prepare incident notification',
    'Port Scanning': '1. Block source IP\n2. Enable port security rules\n3. Run vulnerability assessment on open ports\n4. Review firewall logs for suspicious patterns\n5. Monitor for follow-up attacks',
    'Malware C2 Communication': '1. Isolate affected host immediately\n2. Block C2 IP at perimeter\n3. Scan system for malware\n4. Preserve forensic evidence\n5. Notify incident response team',
    'Data Exfiltration': '1. Terminate connection immediately\n2. Isolate affected endpoint\n3. Preserve network logs\n4. Scan for data collection tools\n5. Audit data access logs',
    'Privilege Escalation': '1. Isolate compromised system\n2. Revoke potentially compromised accounts\n3. Review privilege escalation techniques\n4. Apply latest security patches\n5. Reset affected credentials',
    'Lateral Movement': '1. Segment network access\n2. Isolate affected systems\n3. Review network shares and trust relationships\n4. Check for credential harvesting\n5. Enable enhanced network monitoring',
  };

  return actions[threat.threat_type] || `1. Investigate threat source\n2. Block source IP\n3. Monitor for escalation\n4. Document incident`;
}

// Fetch from external threat intelligence (placeholder for real integration)
export async function fetchExternalThreatIntel() {
  try {
    // This would connect to real threat intelligence feeds:
    // - MISP
    // - AlienVault OTX
    // - Shodan
    // - VirusTotal
    // - MaxMind GeoIP2
    // For now, returning mock data
    return { success: true, message: 'External threat intel sync in progress' };
  } catch (error) {
    console.error('Failed to fetch external threat intel:', error);
    throw error;
  }
}

// Start periodic data sync
export function startDataSyncInterval(intervalMs: number = 30000) {
  setInterval(async () => {
    try {
      await ingestThreatsFromSources();
      await generateAlertsFromThreats();
    } catch (error) {
      console.error('Data sync error:', error);
    }
  }, intervalMs);
}
