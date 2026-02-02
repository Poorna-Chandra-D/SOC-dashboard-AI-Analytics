import { useEffect, useState } from 'react';
import { supabase, Alert } from '@/lib/supabase';
import { Bell, Filter, CheckCircle, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

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

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchAlerts() {
      const { data } = await supabase.from('alerts').select('*').order('created_at', { ascending: false });
      setAlerts(data || []);
    }
    fetchAlerts();
  }, []);

  const filtered = alerts.filter(a => 
    (filter === 'all' || a.severity === filter) &&
    (statusFilter === 'all' || a.status === statusFilter)
  );

  const counts = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    high: alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length,
    open: alerts.filter(a => a.status === 'open' || a.status === 'active').length,
  };

  return (
    <div className="flex gap-md h-full">
      {/* Filter Sidebar */}
      <div className="w-48 flex-shrink-0 bg-bg-surface border border-border-subtle rounded-lg p-md">
        <div className="flex items-center gap-sm mb-md">
          <Filter size={16} className="text-text-muted" />
          <span className="text-small text-text-muted uppercase">Filters</span>
        </div>

        <div className="mb-lg">
          <h3 className="text-small text-text-muted mb-sm">Severity</h3>
          {['all', 'critical', 'high', 'medium', 'low'].map(sev => (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={`w-full text-left px-sm py-xs rounded text-small mb-xs transition-all ${
                filter === sev ? 'bg-cyber-primary/10 text-cyber-primary' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}
              {sev !== 'all' && counts[sev as keyof typeof counts] !== undefined && (
                <span className="float-right text-xs bg-bg-elevated px-xs rounded">
                  {counts[sev as keyof typeof counts]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div>
          <h3 className="text-small text-text-muted mb-sm">Status</h3>
          {['all', 'active', 'investigating', 'mitigated'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`w-full text-left px-sm py-xs rounded text-small mb-xs transition-all ${
                statusFilter === st ? 'bg-cyber-primary/10 text-cyber-primary' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {st === 'all' ? 'All' : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Table */}
      <div className="flex-1 bg-bg-surface border border-border-subtle rounded-lg p-md overflow-hidden">
        <div className="flex items-center justify-between mb-md">
          <div className="flex items-center gap-sm">
            <Bell size={18} className="text-cyber-primary" />
            <h1 className="text-h1 font-semibold text-text-main">Alert Queue</h1>
          </div>
          <span className="text-small text-text-muted">{filtered.length} alerts</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-bg-elevated text-small text-text-muted uppercase">
                <th className="text-left p-sm">ID</th>
                <th className="text-left p-sm">Alert</th>
                <th className="text-left p-sm">Source</th>
                <th className="text-left p-sm">Severity</th>
                <th className="text-left p-sm">Status</th>
                <th className="text-left p-sm">Time</th>
                <th className="text-left p-sm"></th>
              </tr>
            </thead>
            <tbody className="font-mono text-small">
              {filtered.map(alert => (
                <tr key={alert.id} className="border-t border-border-subtle hover:bg-bg-elevated transition-all">
                  <td className="p-sm text-text-muted">{alert.id.slice(0, 8)}</td>
                  <td className="p-sm text-text-main max-w-xs truncate">{alert.title}</td>
                  <td className="p-sm text-cyber-primary">{alert.source}</td>
                  <td className="p-sm"><SeverityBadge severity={alert.severity} /></td>
                  <td className="p-sm">
                    <span className={`flex items-center gap-xs ${
                      alert.status === 'active' || alert.status === 'open' ? 'text-status-critical' : 
                      alert.status === 'investigating' ? 'text-status-warning' : 'text-status-success'
                    }`}>
                      {alert.status === 'active' || alert.status === 'open' ? <AlertTriangle size={14} /> : 
                       alert.status === 'investigating' ? <Clock size={14} /> : <CheckCircle size={14} />}
                      {alert.status}
                    </span>
                  </td>
                  <td className="p-sm text-text-muted">
                    {new Date(alert.created_at).toLocaleString()}
                  </td>
                  <td className="p-sm">
                    <Link 
                      to={`/analysis/${alert.id}`}
                      className="text-cyber-primary hover:text-cyber-primary/80"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
