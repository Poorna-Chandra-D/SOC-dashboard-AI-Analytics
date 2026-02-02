import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UploadCloud, FileText, AlertTriangle, Database, Activity, Brain } from 'lucide-react';
import { parsePcapFile, type PcapParseResult, type PcapEventAggregate } from '@/lib/pcapParser';

type NetworkEvent = {
  id: string;
  event_type: string;
  source_ip: string | null;
  destination_ip: string | null;
  protocol: string | null;
  bytes_transferred: number | null;
  packets: number | null;
  is_anomaly: boolean | null;
  created_at: string;
};

type NetworkEventInsert = {
  event_type: string;
  source_ip: string | null;
  destination_ip: string | null;
  protocol: string | null;
  bytes_transferred: number;
  packets: number;
  is_anomaly: boolean;
};

type AnalysisLog = {
  id: string;
  analysis_type: string;
  output_response: string | null;
  input_data?: {
    summary?: PcapParseResult['summary'];
    topTalkers?: Array<{
      source: string;
      destination: string;
      protocol: string;
      bytes: number;
    }>;
  } | null;
  created_at: string;
};

export default function PcapInsightsPage() {
  const [pcapResult, setPcapResult] = useState<PcapParseResult | null>(null);
  const [pcapFileName, setPcapFileName] = useState<string | null>(null);
  const [pcapError, setPcapError] = useState<string | null>(null);
  const [pcapImporting, setPcapImporting] = useState<boolean>(false);
  const [recentEvents, setRecentEvents] = useState<NetworkEvent[]>([]);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [storedAnalysis, setStoredAnalysis] = useState<AnalysisLog | null>(null);
  const [storedSummary, setStoredSummary] = useState<{
    lastImport?: string;
    totalEvents: number;
    totalBytes: number;
    topProtocols: Array<{ protocol: string; count: number }>;
    criticalEvents: number;
  }>({ totalEvents: 0, totalBytes: 0, topProtocols: [], criticalEvents: 0 });

  const refreshStoredEvents = async () => {
    const { data } = await supabase
      .from('network_events')
      .select('*')
      .ilike('event_type', 'pcap_%')
      .order('created_at', { ascending: false })
      .limit(200);

    const events = data || [];
    setRecentEvents(events.slice(0, 20));
    if (events.length > 0) {
      const totalBytes = events.reduce((sum, ev) => sum + (ev.bytes_transferred || 0), 0);
      const criticalEvents = events.filter(ev => ev.is_anomaly).length;
      const protocolCounts = new Map<string, number>();
      for (const ev of events) {
        const protocol = ev.protocol || 'Unknown';
        protocolCounts.set(protocol, (protocolCounts.get(protocol) || 0) + 1);
      }
      const topProtocols = Array.from(protocolCounts.entries())
        .map(([protocol, count]) => ({ protocol, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      setStoredSummary({
        lastImport: events[0]?.created_at,
        totalEvents: events.length,
        totalBytes,
        topProtocols,
        criticalEvents,
      });
    } else {
      setStoredSummary({ totalEvents: 0, totalBytes: 0, topProtocols: [], criticalEvents: 0 });
    }
  };

  useEffect(() => {
    refreshStoredEvents();
    const fetchLatestAnalysis = async () => {
      const { data } = await supabase
        .from('ai_analysis_logs')
        .select('id, analysis_type, output_response, input_data, created_at')
        .eq('analysis_type', 'pcap')
        .order('created_at', { ascending: false })
        .limit(1);
      setStoredAnalysis(data?.[0] || null);
    };
    fetchLatestAnalysis();
  }, []);

  const handlePcapUpload = async (file: File) => {
    setPcapError(null);
    setPcapResult(null);
    setPcapFileName(file.name);
    setAnalysisText(null);
    setAnalysisError(null);

    if (!file.name.toLowerCase().endsWith('.pcap')) {
      setPcapError('Please upload a .pcap file. For Wireshark, export as libpcap.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setPcapError('File is larger than 50MB. Please export a smaller capture.');
      return;
    }

    try {
      const result = await parsePcapFile(file);
      setPcapResult(result);
      if (result.warnings.length > 0) {
        setPcapError(result.warnings.join(' '));
      }
      await runAiAnalysis(result);
    } catch (error) {
      setPcapError(error instanceof Error ? error.message : 'Failed to parse PCAP.');
    }
  };

  const handleImportNetworkEvents = async () => {
    if (!pcapResult) return;
    setPcapImporting(true);
    try {
      const payload: NetworkEventInsert[] = pcapResult.events.map(event => {
        const appTag = event.app_protocol ? event.app_protocol.toLowerCase() : event.protocol.toLowerCase();
        const anomaly = getAnomalyReasons(event);
        return {
          event_type: `pcap_${appTag}`,
          source_ip: event.source_ip || null,
          destination_ip: event.destination_ip || null,
          protocol: event.app_protocol ? `${event.protocol}/${event.app_protocol}` : event.protocol || null,
          bytes_transferred: event.bytes_transferred,
          packets: event.packets,
          is_anomaly: anomaly.length > 0,
        };
      });

      const { error } = await supabase.from('network_events').insert(payload);
      if (error) {
        setPcapError(`Import failed: ${error.message}`);
      } else {
        setPcapError(null);
        await refreshStoredEvents();
      }
    } catch (error) {
      setPcapError(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setPcapImporting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const runAiAnalysis = async (result: PcapParseResult) => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const topTalkers = result.events.slice(0, 5).map(event => ({
        source: `${event.source_ip}${event.src_port ? `:${event.src_port}` : ''}`,
        destination: `${event.destination_ip}${event.dst_port ? `:${event.dst_port}` : ''}`,
        protocol: event.app_protocol ? `${event.protocol}/${event.app_protocol}` : event.protocol,
        bytes: event.bytes_transferred,
      }));

      const inputData = {
        summary: result.summary,
        topTalkers,
        warnings: result.warnings,
      };

      const endpoint = import.meta.env.VITE_LLM_ENDPOINT as string | undefined;
      const apiKey = import.meta.env.VITE_LLM_API_KEY as string | undefined;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      let analysisOutput = '';
      if (endpoint) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            ...(apiKey ? { 'x-api-key': apiKey } : {}),
          },
          body: JSON.stringify({
            analysis_type: 'pcap',
            input: inputData,
            prompt:
              'Analyze this PCAP summary for threats, anomalies, and recommendations. Return concise bullet points and a risk rating.',
          }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('AI analysis failed:', response.status, errorData);
          throw new Error(
            `AI analysis failed (${response.status}): ${errorData.error || errorData.message || 'Unknown error'}`
          );
        }
        const data = await response.json();
        analysisOutput =
          data.analysis ||
          data.output ||
          data.response ||
          data.choices?.[0]?.message?.content ||
          'AI analysis completed.';
      } else {
        const riskScore =
          result.summary.tlsPackets + result.summary.httpPackets + result.summary.dnsPackets > 0
            ? 'medium'
            : 'low';
        analysisOutput = [
          `Risk rating: ${riskScore.toUpperCase()}`,
          `Total packets: ${result.summary.totalPackets}, total bytes: ${formatBytes(result.summary.totalBytes)}.`,
          `Top protocols: TCP ${result.summary.tcpPackets}, UDP ${result.summary.udpPackets}, DNS ${result.summary.dnsPackets}, HTTP ${result.summary.httpPackets}, TLS ${result.summary.tlsPackets}.`,
          `Top talkers: ${topTalkers.map(t => `${t.source} → ${t.destination} (${t.protocol})`).join('; ') || 'N/A'}.`,
          'Recommendations: review critical insights, validate suspicious ports, and inspect long DNS queries.',
        ].join('\n');
      }

      setAnalysisText(analysisOutput);

      await supabase.from('ai_analysis_logs').insert({
        analysis_type: 'pcap',
        input_data: inputData,
        output_response: analysisOutput,
        confidence_score: endpoint ? 0.72 : 0.45,
        model_version: endpoint ? 'custom-llm' : 'rules-based-v1',
      });

      const { data } = await supabase
        .from('ai_analysis_logs')
        .select('id, analysis_type, output_response, input_data, created_at')
        .eq('analysis_type', 'pcap')
        .order('created_at', { ascending: false })
        .limit(1);
      setStoredAnalysis(data?.[0] || null);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'AI analysis failed.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleClearInsights = async () => {
    setAnalysisText(null);
    setPcapResult(null);
    setPcapFileName(null);
    setPcapError(null);
    setAnalysisError(null);
    setStoredAnalysis(null);
    setStoredSummary({ totalEvents: 0, totalBytes: 0, topProtocols: [], criticalEvents: 0 });
    setRecentEvents([]);

    await supabase.from('ai_analysis_logs').delete().eq('analysis_type', 'pcap');
    await supabase.from('network_events').delete().ilike('event_type', 'pcap_%');
  };

  const getAnomalyReasons = (event: PcapEventAggregate) => {
    const reasons: string[] = [];
    const suspiciousPorts = new Set([22, 23, 3389, 445, 1433, 3306, 5900, 6379, 27017]);
    if (event.src_port && suspiciousPorts.has(event.src_port)) {
      reasons.push(`Suspicious source port ${event.src_port}`);
    }
    if (event.dst_port && suspiciousPorts.has(event.dst_port)) {
      reasons.push(`Suspicious destination port ${event.dst_port}`);
    }
    if (event.bytes_transferred > 5 * 1024 * 1024) {
      reasons.push('High data transfer volume');
    }
    if (event.app_protocol === 'DNS' && event.details?.dns?.query) {
      const query = event.details.dns.query;
      if (query.length > 50) reasons.push('Long DNS query');
      if (event.details.dns.type === 'TXT') reasons.push('DNS TXT query');
      if (query.split('.').length > 6) reasons.push('High DNS label count');
    }
    if (event.app_protocol === 'HTTP' && event.details?.http?.method) {
      const method = event.details.http.method.toUpperCase();
      if (['POST', 'PUT', 'DELETE'].includes(method)) reasons.push(`HTTP ${method} request`);
    }
    if (event.app_protocol === 'TLS' && event.details?.tls?.sni === undefined) {
      reasons.push('TLS without SNI');
    }
    return reasons;
  };

  return (
    <div className="space-y-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 font-semibold text-text-main">PCAP Insights</h1>
          <p className="text-small text-text-muted">Wireshark captures → deep protocol decoding</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
          <div className="flex items-center gap-sm mb-md">
            <UploadCloud size={18} className="text-cyber-primary" />
            <h2 className="text-h2 font-medium text-text-main">Upload Capture</h2>
          </div>

          <div className="space-y-sm">
            <label className="flex flex-col gap-xs text-small text-text-muted">
              Upload .pcap capture
              <input
                type="file"
                accept=".pcap"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePcapUpload(file);
                }}
                className="w-full bg-bg-base border border-border-subtle rounded px-sm py-xs text-small text-text-main"
              />
            </label>

            {pcapFileName && (
              <div className="flex items-center gap-sm text-small text-text-main">
                <FileText size={14} className="text-cyber-primary" />
                {pcapFileName}
              </div>
            )}

            {pcapError && (
              <div className="flex items-start gap-sm text-small text-status-critical bg-status-critical/10 border border-status-critical/30 rounded p-sm">
                <AlertTriangle size={14} className="mt-0.5" />
                <span>{pcapError}</span>
              </div>
            )}

            <button
              onClick={handleImportNetworkEvents}
              disabled={!pcapResult || pcapImporting}
              className="w-full flex items-center justify-center gap-xs bg-cyber-primary/10 border border-cyber-primary/30 text-cyber-primary rounded px-sm py-xs text-small hover:bg-cyber-primary/20 disabled:opacity-50"
            >
              {pcapImporting ? 'Importing…' : 'Import to Network Events'}
            </button>
            <button
              onClick={() => pcapResult && runAiAnalysis(pcapResult)}
              disabled={!pcapResult || analysisLoading}
              className="w-full flex items-center justify-center gap-xs bg-bg-elevated border border-border-subtle text-text-main rounded px-sm py-xs text-small hover:bg-bg-elevated/70 disabled:opacity-50"
            >
              {analysisLoading ? 'Analyzing…' : 'Run AI Analysis'}
            </button>
            {analysisError && (
              <div className="flex items-start gap-sm text-small text-status-critical bg-status-critical/10 border border-status-critical/30 rounded p-sm">
                <AlertTriangle size={14} className="mt-0.5" />
                <span>{analysisError}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
          <div className="flex items-center gap-sm mb-md">
            <Activity size={18} className="text-status-success" />
            <h2 className="text-h2 font-medium text-text-main">Analysis Summary</h2>
          </div>
          {pcapResult ? (
            <div className="grid grid-cols-2 gap-sm text-small">
              <div>
                <div className="text-text-muted">Packets</div>
                <div className="text-text-main font-mono">{pcapResult.summary.totalPackets}</div>
              </div>
              <div>
                <div className="text-text-muted">Total Size</div>
                <div className="text-text-main font-mono">{formatBytes(pcapResult.summary.totalBytes)}</div>
              </div>
              <div>
                <div className="text-text-muted">IPv4 Packets</div>
                <div className="text-text-main font-mono">{pcapResult.summary.ipv4Packets}</div>
              </div>
              <div>
                <div className="text-text-muted">Unknown Packets</div>
                <div className="text-text-main font-mono">{pcapResult.summary.unknownPackets}</div>
              </div>
              <div>
                <div className="text-text-muted">TCP / UDP</div>
                <div className="text-text-main font-mono">
                  {pcapResult.summary.tcpPackets} / {pcapResult.summary.udpPackets}
                </div>
              </div>
              <div>
                <div className="text-text-muted">HTTP / TLS / DNS</div>
                <div className="text-text-main font-mono">
                  {pcapResult.summary.httpPackets} / {pcapResult.summary.tlsPackets} / {pcapResult.summary.dnsPackets}
                </div>
              </div>
              <div>
                <div className="text-text-muted">Start</div>
                <div className="text-text-main">{pcapResult.summary.startTime ? new Date(pcapResult.summary.startTime).toLocaleString() : '—'}</div>
              </div>
              <div>
                <div className="text-text-muted">End</div>
                <div className="text-text-main">{pcapResult.summary.endTime ? new Date(pcapResult.summary.endTime).toLocaleString() : '—'}</div>
              </div>
            </div>
          ) : (
            <div className="text-small text-text-muted">Upload a capture to see summary.</div>
          )}
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
        <div className="flex items-center gap-sm mb-md">
          <Brain size={18} className="text-cyber-primary" />
          <h2 className="text-h2 font-medium text-text-main">AI PCAP Analysis</h2>
        </div>
        {analysisText ? (
          <pre className="whitespace-pre-wrap text-small text-text-main bg-bg-base rounded-lg p-sm border border-border-subtle">
            {analysisText}
          </pre>
        ) : storedAnalysis?.output_response ? (
          <pre className="whitespace-pre-wrap text-small text-text-main bg-bg-base rounded-lg p-sm border border-border-subtle">
            {storedAnalysis.output_response}
          </pre>
        ) : (
          <div className="text-small text-text-muted">Upload a PCAP and run AI analysis to view insights.</div>
        )}
        {storedAnalysis?.created_at && (
          <div className="text-xs text-text-muted mt-xs">
            Last analysis: {new Date(storedAnalysis.created_at).toLocaleString()}
          </div>
        )}
        {!import.meta.env.VITE_LLM_ENDPOINT && (
          <div className="text-xs text-text-muted mt-xs">
            Using rules-based analysis. Set VITE_LLM_ENDPOINT to enable LLM output.
          </div>
        )}
        {(storedAnalysis || storedSummary.totalEvents > 0 || pcapResult) && (
          <div className="mt-sm">
            <button
              onClick={handleClearInsights}
              className="text-small text-status-critical hover:underline"
            >
              Clear stored PCAP insights
            </button>
          </div>
        )}
      </div>

      {pcapResult && pcapResult.events.length > 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
          <div className="flex items-center gap-sm mb-md">
            <Database size={18} className="text-cyber-primary" />
            <h2 className="text-h2 font-medium text-text-main">Top Talkers & Protocols</h2>
          </div>
          <div className="bg-bg-base border border-border-subtle rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-sm px-sm py-xs text-xs text-text-muted border-b border-border-subtle">
              <div className="col-span-4">Source</div>
              <div className="col-span-4">Destination</div>
              <div className="col-span-2">Protocol</div>
              <div className="col-span-2 text-right">Bytes</div>
            </div>
            {pcapResult.events.slice(0, 10).map((event, index) => (
              (() => {
                const anomalyReasons = getAnomalyReasons(event);
                const isCritical = anomalyReasons.length > 0;
                return (
              <div
                key={`${event.source_ip}-${event.destination_ip}-${event.protocol}-${index}`}
                className="grid grid-cols-12 gap-sm px-sm py-xs text-xs text-text-main border-b border-border-subtle/30"
              >
                <div className="col-span-4 font-mono text-cyber-primary truncate">
                  {event.source_ip}{event.src_port ? `:${event.src_port}` : ''}
                </div>
                <div className="col-span-4 font-mono truncate">
                  {event.destination_ip}{event.dst_port ? `:${event.dst_port}` : ''}
                </div>
                <div className="col-span-2">
                  {event.app_protocol ? `${event.protocol}/${event.app_protocol}` : event.protocol}
                </div>
                <div className="col-span-2 text-right font-mono">{formatBytes(event.bytes_transferred)}</div>
                {isCritical && (
                  <div className="col-span-12 text-xs text-status-critical">
                    Critical: {anomalyReasons.join(', ')}
                  </div>
                )}
                {(event.details?.dns || event.details?.http || event.details?.tls) && (
                  <div className="col-span-12 text-xs text-text-muted pb-xs">
                    {event.details?.dns && (
                      <span>DNS {event.details.dns.type} {event.details.dns.query}</span>
                    )}
                    {event.details?.http && (
                      <span>
                        HTTP {event.details.http.method ? event.details.http.method : ''}
                        {event.details.http.path ? ` ${event.details.http.path}` : ''}
                        {event.details.http.status ? ` ${event.details.http.status}` : ''}
                        {event.details.http.host ? ` (${event.details.http.host})` : ''}
                      </span>
                    )}
                    {event.details?.tls && (
                      <span>
                        TLS{event.details.tls.version ? ` ${event.details.tls.version}` : ''}
                        {event.details.tls.sni ? ` SNI ${event.details.tls.sni}` : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
                );
              })()
            ))}
          </div>
        </div>
      )}

      {!pcapResult && storedSummary.totalEvents > 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-small text-text-muted uppercase tracking-wide">Last Imported Insights</div>
              <div className="text-h3 font-medium text-text-main">Latest Stored Capture</div>
              <div className="text-small text-text-muted mt-xs">
                {storedSummary.lastImport ? `Last import: ${new Date(storedSummary.lastImport).toLocaleString()}` : '—'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md mt-md text-small">
            <div className="bg-bg-elevated border border-border-subtle rounded-md p-sm">
              <div className="text-text-muted">Events Imported</div>
              <div className="text-text-main font-mono text-h3">{storedSummary.totalEvents}</div>
            </div>
            <div className="bg-bg-elevated border border-border-subtle rounded-md p-sm">
              <div className="text-text-muted">Total Bytes</div>
              <div className="text-text-main font-mono text-h3">{formatBytes(storedSummary.totalBytes)}</div>
            </div>
            <div className="bg-bg-elevated border border-border-subtle rounded-md p-sm">
              <div className="text-text-muted">Top Protocols</div>
              {storedSummary.topProtocols.length === 0 ? (
                <div className="text-text-main">—</div>
              ) : (
                <ul className="mt-xs space-y-1">
                  {storedSummary.topProtocols.map(item => (
                    <li key={item.protocol} className="text-text-main">
                      {item.protocol} · {item.count}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="mt-sm text-small">
            <span className="text-text-muted">Critical insights: </span>
            <span className="text-status-critical font-medium">{storedSummary.criticalEvents}</span>
          </div>
          {storedAnalysis?.input_data?.topTalkers && storedAnalysis.input_data.topTalkers.length > 0 && (
            <div className="mt-md">
              <div className="text-small text-text-muted mb-sm">Top Talkers (Last Analysis)</div>
              <div className="bg-bg-base border border-border-subtle rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-sm px-sm py-xs text-xs text-text-muted border-b border-border-subtle">
                  <div className="col-span-5">Source</div>
                  <div className="col-span-5">Destination</div>
                  <div className="col-span-2 text-right">Bytes</div>
                </div>
                {storedAnalysis.input_data.topTalkers.map((talker, index) => (
                  <div
                    key={`${talker.source}-${talker.destination}-${index}`}
                    className="grid grid-cols-12 gap-sm px-sm py-xs text-xs text-text-main border-b border-border-subtle/30"
                  >
                    <div className="col-span-5 font-mono text-cyber-primary truncate">{talker.source}</div>
                    <div className="col-span-5 font-mono truncate">{talker.destination}</div>
                    <div className="col-span-2 text-right font-mono">{formatBytes(talker.bytes)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
        <div className="flex items-center gap-sm mb-md">
          <Database size={18} className="text-cyber-primary" />
          <h2 className="text-h2 font-medium text-text-main">Recent Network Events</h2>
        </div>
        <div className="bg-bg-base border border-border-subtle rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-sm px-sm py-xs text-xs text-text-muted border-b border-border-subtle">
            <div className="col-span-3">Source</div>
            <div className="col-span-3">Destination</div>
            <div className="col-span-2">Protocol</div>
            <div className="col-span-2">Event</div>
            <div className="col-span-2 text-right">Bytes</div>
          </div>
          {recentEvents.length === 0 ? (
            <div className="px-sm py-sm text-small text-text-muted">No network events imported yet.</div>
          ) : (
            recentEvents.map(event => (
              <div
                key={event.id}
                className="grid grid-cols-12 gap-sm px-sm py-xs text-xs text-text-main border-b border-border-subtle/30"
              >
                <div className="col-span-3 font-mono text-cyber-primary truncate">{event.source_ip || '—'}</div>
                <div className="col-span-3 font-mono truncate">{event.destination_ip || '—'}</div>
                <div className="col-span-2">{event.protocol || '—'}</div>
                <div className="col-span-2">
                  {event.is_anomaly ? (
                    <span className="text-status-critical font-medium">Critical</span>
                  ) : (
                    event.event_type
                  )}
                </div>
                <div className="col-span-2 text-right font-mono">
                  {event.bytes_transferred ? formatBytes(event.bytes_transferred) : '—'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
