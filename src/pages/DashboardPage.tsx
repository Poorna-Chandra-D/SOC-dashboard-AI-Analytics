import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Threat, Alert } from '@/lib/supabase';
import { ingestThreatsFromSources, generateAlertsFromThreats } from '@/lib/threatDataSync';
import {
  ShieldAlert,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Globe,
  Brain,
  FileSearch,
} from 'lucide-react';

function StatusCard({ title, value, trend, icon: Icon, color }: {
  title: string;
  value: string | number;
  trend?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-lg p-md hover:border-cyber-primary hover:shadow-glow transition-all">
      <div className="flex justify-between items-start mb-sm">
        <span className="text-small text-text-muted uppercase tracking-wide">{title}</span>
        <Icon size={20} className={color} />
      </div>
      <div className="text-hero font-bold text-text-main">{value}</div>
      {trend && <span className="text-small text-status-success">{trend}</span>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-status-critical/15 text-status-critical border-status-critical',
    high: 'bg-status-warning/15 text-status-warning border-status-warning',
    medium: 'bg-yellow-500/15 text-yellow-500 border-yellow-500',
    low: 'bg-status-success/15 text-status-success border-status-success',
  };
  return (
    <span className={`px-sm py-xs rounded-sm text-small border ${colors[severity] || colors.low}`}>
      {severity.toUpperCase()}
    </span>
  );
}

export default function DashboardPage() {
  const [threats, setThreats] = useState<Threat[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [pcapSummary, setPcapSummary] = useState<{
    lastImport?: string;
    totalEvents: number;
    totalBytes: number;
    topProtocols: Array<{ protocol: string; count: number }>;
  }>({ totalEvents: 0, totalBytes: 0, topProtocols: [] });
  const [pcapAiSummary, setPcapAiSummary] = useState<{
    createdAt?: string;
    output?: string;
  }>({});

  useEffect(() => {
    async function fetchData() {
      try {
        // Sync new threats from sources
        await ingestThreatsFromSources();
        await generateAlertsFromThreats();

        const [{ data: t }, { data: a }, { data: pcapEvents }, { data: pcapAi }] = await Promise.all([
          supabase.from('threats').select('*').order('detected_at', { ascending: false }),
          supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(5),
          supabase
            .from('network_events')
            .select('*')
            .ilike('event_type', 'pcap_%')
            .order('created_at', { ascending: false })
            .limit(200),
          supabase
            .from('ai_analysis_logs')
            .select('created_at, output_response')
            .eq('analysis_type', 'pcap')
            .order('created_at', { ascending: false })
            .limit(1),
        ]);
        setThreats(t || []);
        setAlerts(a || []);
        setPcapAiSummary({
          createdAt: pcapAi?.[0]?.created_at,
          output: pcapAi?.[0]?.output_response,
        });
        if (pcapEvents && pcapEvents.length > 0) {
          const totalBytes = pcapEvents.reduce((sum, ev) => sum + (ev.bytes_transferred || 0), 0);
          const protocolCounts = new Map<string, number>();
          for (const ev of pcapEvents) {
            const protocol = ev.protocol || 'Unknown';
            protocolCounts.set(protocol, (protocolCounts.get(protocol) || 0) + 1);
          }
          const topProtocols = Array.from(protocolCounts.entries())
            .map(([protocol, count]) => ({ protocol, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);
          setPcapSummary({
            lastImport: pcapEvents[0]?.created_at,
            totalEvents: pcapEvents.length,
            totalBytes,
            topProtocols,
          });
        } else {
          setPcapSummary({ totalEvents: 0, totalBytes: 0, topProtocols: [] });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    // Poll for new threats every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeThreats = threats.filter(t => t.status === 'active').length;
  const criticalCount = threats.filter(t => t.severity === 'critical').length;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-cyber-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-semibold text-text-main">Security Overview</h1>
        <div className="flex items-center gap-sm text-small text-text-muted">
          <Clock size={14} />
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
        <StatusCard title="Active Threats" value={activeThreats} icon={ShieldAlert} color="text-status-critical" />
        <StatusCard title="Critical Alerts" value={criticalCount} icon={AlertTriangle} color="text-status-warning" />
        <StatusCard title="System Health" value="98.5%" trend="+0.3%" icon={Activity} color="text-status-success" />
        <StatusCard title="Risk Score" value="74" icon={TrendingUp} color="text-cyber-primary" />
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-small text-text-muted uppercase tracking-wide">PCAP Import Summary</div>
            <div className="text-h3 font-medium text-text-main">Latest Capture</div>
            <div className="text-small text-text-muted mt-xs">
              {pcapSummary.lastImport ? `Last import: ${new Date(pcapSummary.lastImport).toLocaleString()}` : 'No PCAP imports yet'}
            </div>
          </div>
          <FileSearch size={24} className="text-cyber-primary" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md mt-md text-small">
          <div className="bg-bg-elevated border border-border-subtle rounded-md p-sm">
            <div className="text-text-muted">Events Imported</div>
            <div className="text-text-main font-mono text-h3">{pcapSummary.totalEvents}</div>
          </div>
          <div className="bg-bg-elevated border border-border-subtle rounded-md p-sm">
            <div className="text-text-muted">Total Bytes</div>
            <div className="text-text-main font-mono text-h3">{formatBytes(pcapSummary.totalBytes)}</div>
          </div>
          <div className="bg-bg-elevated border border-border-subtle rounded-md p-sm">
            <div className="text-text-muted">Top Protocols</div>
            {pcapSummary.topProtocols.length === 0 ? (
              <div className="text-text-main">—</div>
            ) : (
              <ul className="mt-xs space-y-1">
                {pcapSummary.topProtocols.map(item => (
                  <li key={item.protocol} className="text-text-main">
                    {item.protocol} · {item.count}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="mt-sm">
          <Link
            to="/pcap-insights"
            className="text-small text-cyber-primary hover:underline"
          >
            View full PCAP analysis →
          </Link>
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
        <div className="flex items-center gap-sm mb-md">
          <Brain size={18} className="text-cyber-primary" />
          <h2 className="text-h2 font-medium text-text-main">Latest AI PCAP Insight</h2>
        </div>
        {pcapAiSummary.output ? (
          <div className="bg-bg-base border border-border-subtle rounded-lg p-sm text-small text-text-main whitespace-pre-wrap">
            {pcapAiSummary.output}
          </div>
        ) : (
          <div className="text-small text-text-muted">No AI analysis available yet.</div>
        )}
        {pcapAiSummary.createdAt && (
          <div className="text-xs text-text-muted mt-xs">
            Generated: {new Date(pcapAiSummary.createdAt).toLocaleString()}
          </div>
        )}
        <div className="mt-sm">
          <Link to="/pcap-insights" className="text-small text-cyber-primary hover:underline">
            View all PCAP insights →
          </Link>
        </div>
      </div>

      {/* Map + Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        <div className="lg:col-span-2 bg-bg-surface border border-border-subtle rounded-lg p-md">
          <div className="flex items-center gap-sm mb-md">
            <Globe size={18} className="text-cyber-primary" />
            <h2 className="text-h2 font-medium text-text-main">Global Threat Map</h2>
          </div>
          <div className="relative h-64 bg-bg-base rounded-lg overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Globe size={48} className="text-cyber-primary/30 mx-auto mb-sm animate-pulse" />
                <p className="text-small text-text-muted">Real-time attack visualization</p>
              </div>
            </div>
            {/* Threat markers */}
            {threats.slice(0, 5).map((threat, i) => (
              <div
                key={threat.id}
                className={`absolute w-3 h-3 rounded-full animate-pulse ${
                  threat.severity === 'critical' ? 'bg-status-critical shadow-critical' : 'bg-status-warning'
                }`}
                style={{
                  left: `${20 + i * 15}%`,
                  top: `${30 + (i % 3) * 20}%`,
                }}
                title={`${threat.threat_type} from ${threat.country}`}
              />
            ))}
          </div>
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
          <div className="flex items-center gap-sm mb-md">
            <Activity size={18} className="text-status-success" />
            <h2 className="text-h2 font-medium text-text-main">Live Feed</h2>
          </div>
          <div className="bg-black rounded-lg p-sm h-64 overflow-y-auto font-mono text-small">
            {threats.map(threat => (
              <div key={threat.id} className="py-xs border-b border-border-subtle/30">
                <span className="text-text-muted">[{new Date(threat.detected_at).toLocaleTimeString()}]</span>{' '}
                <span className={threat.severity === 'critical' ? 'text-status-critical' : 'text-status-success'}>
                  {threat.threat_type}
                </span>{' '}
                <span className="text-text-muted">from</span>{' '}
                <span className="text-cyber-primary">{threat.source_ip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Alerts + AI Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        <div className="lg:col-span-2 bg-bg-surface border border-border-subtle rounded-lg p-md">
          <h2 className="text-h2 font-medium text-text-main mb-md">Recent Alerts</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-bg-elevated text-small text-text-muted uppercase">
                  <th className="text-left p-sm">Alert</th>
                  <th className="text-left p-sm">Source</th>
                  <th className="text-left p-sm">Severity</th>
                  <th className="text-left p-sm">Status</th>
                </tr>
              </thead>
              <tbody className="font-mono text-small">
                {alerts.map(alert => (
                  <tr key={alert.id} className="border-t border-border-subtle hover:bg-bg-elevated">
                    <td className="p-sm text-text-main">{alert.title}</td>
                    <td className="p-sm text-cyber-primary">{alert.source}</td>
                    <td className="p-sm"><SeverityBadge severity={alert.severity} /></td>
                    <td className="p-sm">
                      <span className={`flex items-center gap-xs ${alert.status === 'active' ? 'text-status-critical' : 'text-status-success'}`}>
                        {alert.status === 'active' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                        {alert.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
          <div className="flex items-center gap-sm mb-md">
            <Brain size={18} className="text-cyber-primary" />
            <h2 className="text-h2 font-medium text-text-main">AI Daily Brief</h2>
          </div>
          <div className="bg-bg-base rounded-lg p-md">
            <p className="text-body text-text-main mb-sm">
              Security posture analysis for the past 24 hours:
            </p>
            <ul className="space-y-sm text-small text-text-muted">
              <li className="flex items-start gap-sm">
                <AlertTriangle size={14} className="text-status-critical mt-1 flex-shrink-0" />
                <span>{criticalCount} critical threats detected, primarily from Eastern Europe and Asia.</span>
              </li>
              <li className="flex items-start gap-sm">
                <Activity size={14} className="text-status-success mt-1 flex-shrink-0" />
                <span>Network anomaly detection rate improved by 12% after model update.</span>
              </li>
              <li className="flex items-start gap-sm">
                <ShieldAlert size={14} className="text-cyber-primary mt-1 flex-shrink-0" />
                <span>Recommend updating firewall rules for SSH port 22 based on brute force patterns.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
