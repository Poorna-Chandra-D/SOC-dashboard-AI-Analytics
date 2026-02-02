import { useEffect, useState } from 'react';
import { supabase, Threat } from '@/lib/supabase';
import { Activity, MapPin, Clock, Filter } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ThreatMonitorPage() {
  const [threats, setThreats] = useState<Threat[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchThreats() {
      const { data } = await supabase.from('threats').select('*').order('detected_at', { ascending: false });
      setThreats(data || []);
    }
    fetchThreats();
    const interval = setInterval(fetchThreats, 10000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === 'all' ? threats : threats.filter(t => t.severity === filter);
  
  const trafficData = [
    { time: '00:00', normal: 120, anomaly: 5 },
    { time: '04:00', normal: 80, anomaly: 2 },
    { time: '08:00', normal: 200, anomaly: 15 },
    { time: '12:00', normal: 350, anomaly: 25 },
    { time: '16:00', normal: 280, anomaly: 18 },
    { time: '20:00', normal: 180, anomaly: 8 },
    { time: 'Now', normal: 220, anomaly: 12 },
  ];


  return (
    <div className="space-y-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-semibold text-text-main">Threat Monitor</h1>
        <div className="flex items-center gap-sm">
          <Filter size={16} className="text-text-muted" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-bg-elevated border border-border-subtle rounded-md px-sm py-xs text-small text-text-main"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        {/* Live Feed Terminal */}
        <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
          <div className="flex items-center gap-sm mb-md">
            <Activity size={18} className="text-status-success" />
            <h2 className="text-h2 font-medium text-text-main">Live Threat Feed</h2>
            <span className="ml-auto flex items-center gap-xs text-small text-status-success">
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
              Live
            </span>
          </div>
          <div className="bg-black rounded-lg p-sm h-96 overflow-y-auto font-mono text-small">
            {filtered.map(threat => (
              <div key={threat.id} className="py-sm border-b border-border-subtle/20">
                <div className="flex items-center gap-sm mb-xs">
                  <span className="text-text-muted">[{new Date(threat.detected_at).toLocaleString()}]</span>
                  <span className={`px-xs rounded text-xs ${
                    threat.severity === 'critical' ? 'bg-status-critical/20 text-status-critical' :
                    threat.severity === 'high' ? 'bg-status-warning/20 text-status-warning' : 'bg-yellow-500/20 text-yellow-500'
                  }`}>
                    {threat.severity.toUpperCase()}
                  </span>
                </div>
                <div className="text-status-success">{threat.threat_type}</div>
                <div className="text-text-muted text-xs">
                  SRC: <span className="text-cyber-primary">{threat.source_ip}</span> | 
                  DST: <span className="text-text-main">{threat.destination_ip}</span> |
                  {threat.country} ({threat.city})
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attack Origin Map */}
        <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
          <div className="flex items-center gap-sm mb-md">
            <MapPin size={18} className="text-cyber-primary" />
            <h2 className="text-h2 font-medium text-text-main">Attack Origins</h2>
          </div>
          <div className="bg-bg-base rounded-lg h-96 relative overflow-hidden">
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(0,229,255,0.1) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(0,229,255,0.1) 0%, transparent 50%)'
            }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-md p-md">
              {threats.slice(0, 6).map((threat, i) => (
                <div key={threat.id} className="flex items-center gap-md w-full bg-bg-surface/50 rounded-md p-sm">
                  <span className={`w-3 h-3 rounded-full animate-pulse ${
                    threat.severity === 'critical' ? 'bg-status-critical shadow-critical' : 'bg-status-warning'
                  }`} />
                  <div className="flex-1">
                    <div className="text-small text-text-main">{threat.country}, {threat.city}</div>
                    <div className="text-xs text-text-muted font-mono">{threat.source_ip}</div>
                  </div>
                  <div className="text-xs text-text-muted">{threat.threat_type}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>


      {/* Traffic Analysis Chart */}
      <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
        <div className="flex items-center gap-sm mb-md">
          <Clock size={18} className="text-cyber-primary" />
          <h2 className="text-h2 font-medium text-text-main">Traffic Analysis (24h)</h2>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trafficData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" stroke="#A0A0A0" fontSize={12} />
              <YAxis stroke="#A0A0A0" fontSize={12} />
              <Tooltip contentStyle={{ background: '#121212', border: '1px solid #333', borderRadius: 8 }} />
              <Line type="monotone" dataKey="normal" stroke="#00E5FF" strokeWidth={2} dot={false} name="Normal Traffic" />
              <Line type="monotone" dataKey="anomaly" stroke="#FF2A2A" strokeWidth={2} dot={false} name="Anomalies" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
