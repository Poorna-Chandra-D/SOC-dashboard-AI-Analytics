import { useState, useEffect } from 'react';
import { Plug, Check, X, RefreshCw, Lock, Trash2 } from 'lucide-react';
import { 
  saveSIEMConfig, 
  getConnectedSIEMs, 
  syncThreatsfromSIEM,
  type SIEMProvider 
} from '@/lib/siemIntegration';

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  lastSync?: string;
  threatCount: number;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    endpoint: '',
    apiKey: '',
    apiSecret: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const providers: SIEMProvider[] = ['splunk', 'elk', 'wazuh', 'sumologic', 'datadog', 'sentinel'];

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const configs = await getConnectedSIEMs();
      const statuses: IntegrationStatus[] = providers.map(provider => {
        const config = configs.find(c => c.provider === provider);
        return {
          provider,
          connected: !!config,
          lastSync: config?.last_sync,
          threatCount: 0,
        };
      });
      setIntegrations(statuses);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    }
  };

  const handleConfigureProvider = async (provider: SIEMProvider) => {
    setConfiguring(provider);
    setFormData({ endpoint: '', apiKey: '', apiSecret: '' });
  };

  const handleSaveConfig = async (provider: SIEMProvider) => {
    try {
      const result = await saveSIEMConfig(
        provider,
        formData.endpoint,
        formData.apiKey,
        formData.apiSecret
      );

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setConfiguring(null);
        loadIntegrations();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error: ${error}` });
    }
  };

  const handleSyncThreatData = async (provider: SIEMProvider) => {
    setSyncing(provider);
    try {
      const result = await syncThreatsfromSIEM(provider);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Sync failed: ${error}` });
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-semibold text-text-main">SIEM Integrations</h1>
        <div className="flex items-center gap-sm">
          <Plug size={20} className="text-cyber-primary" />
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-md ${
            message.type === 'success'
              ? 'bg-status-success/10 border-status-success/30 text-status-success'
              : 'bg-status-critical/10 border-status-critical/30 text-status-critical'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        {integrations.map(integration => (
          <div
            key={integration.provider}
            className="bg-bg-surface border border-border-subtle rounded-lg p-md"
          >
            <div className="flex items-start justify-between mb-md">
              <div className="flex items-center gap-sm">
                <Plug size={18} className="text-cyber-primary" />
                <div>
                  <h3 className="text-h3 font-medium text-text-main capitalize">
                    {integration.provider}
                  </h3>
                  <p className="text-small text-text-muted">
                    {integration.provider === 'splunk' && 'Real-time Security Analytics'}
                    {integration.provider === 'elk' &&
                      'Elasticsearch, Logstash & Kibana Stack'}
                    {integration.provider === 'wazuh' &&
                      'Open Source Security Monitoring'}
                    {integration.provider === 'sumologic' && 'Cloud SIEM & Analytics'}
                    {integration.provider === 'datadog' && 'Cloud Monitoring & SIEM'}
                    {integration.provider === 'sentinel' &&
                      'Microsoft Sentinel Cloud SIEM'}
                  </p>
                </div>
              </div>
              <div
                className={`flex items-center gap-sm px-sm py-xs rounded-full text-small ${
                  integration.connected
                    ? 'bg-status-success/20 text-status-success'
                    : 'bg-status-warning/20 text-status-warning'
                }`}
              >
                {integration.connected ? (
                  <>
                    <Check size={14} />
                    Connected
                  </>
                ) : (
                  <>
                    <X size={14} />
                    Not Connected
                  </>
                )}
              </div>
            </div>

            {configuring === integration.provider ? (
              <div className="space-y-sm bg-bg-elevated rounded p-sm">
                <input
                  type="text"
                  placeholder="Endpoint URL"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  className="w-full bg-bg-base border border-border-subtle rounded px-sm py-xs text-small text-text-main"
                />
                <input
                  type="password"
                  placeholder="API Key"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="w-full bg-bg-base border border-border-subtle rounded px-sm py-xs text-small text-text-main"
                />
                {['sumologic'].includes(integration.provider) && (
                  <input
                    type="password"
                    placeholder="API Secret"
                    value={formData.apiSecret}
                    onChange={(e) =>
                      setFormData({ ...formData, apiSecret: e.target.value })
                    }
                    className="w-full bg-bg-base border border-border-subtle rounded px-sm py-xs text-small text-text-main"
                  />
                )}
                <div className="flex gap-sm">
                  <button
                    onClick={() => handleSaveConfig(integration.provider as SIEMProvider)}
                    className="flex-1 bg-status-success/10 border border-status-success/30 text-status-success rounded px-sm py-xs text-small hover:bg-status-success/20"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setConfiguring(null)}
                    className="flex-1 bg-status-critical/10 border border-status-critical/30 text-status-critical rounded px-sm py-xs text-small hover:bg-status-critical/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-sm">
                {integration.connected && (
                  <>
                    <div className="flex items-center justify-between text-small">
                      <span className="text-text-muted">Last Sync:</span>
                      <span className="text-text-main">
                        {integration.lastSync
                          ? new Date(integration.lastSync).toLocaleString()
                          : 'Never'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-small">
                      <span className="text-text-muted">Threats Imported:</span>
                      <span className="text-cyber-primary font-mono">
                        {integration.threatCount}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex gap-sm">
                  {integration.connected && (
                    <button
                      onClick={() => handleSyncThreatData(integration.provider as SIEMProvider)}
                      disabled={syncing === integration.provider}
                      className="flex-1 flex items-center justify-center gap-xs bg-cyber-primary/10 border border-cyber-primary/30 text-cyber-primary rounded px-sm py-xs text-small hover:bg-cyber-primary/20 disabled:opacity-50"
                    >
                      {syncing === integration.provider ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={14} />
                          Sync Data
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => handleConfigureProvider(integration.provider as SIEMProvider)}
                    className="flex-1 flex items-center justify-center gap-xs bg-status-warning/10 border border-status-warning/30 text-status-warning rounded px-sm py-xs text-small hover:bg-status-warning/20"
                  >
                    <Lock size={14} />
                    {integration.connected ? 'Reconfigure' : 'Configure'}
                  </button>

                  {integration.connected && (
                    <button className="flex items-center justify-center gap-xs bg-status-critical/10 border border-status-critical/30 text-status-critical rounded px-sm py-xs text-small hover:bg-status-critical/20">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Integration Guide */}
      <div className="bg-bg-surface border border-border-subtle rounded-lg p-md">
        <h2 className="text-h2 font-medium text-text-main mb-md">Integration Guide</h2>
        <div className="space-y-md">
          <div>
            <h3 className="text-h3 font-medium text-cyber-primary mb-sm">Splunk</h3>
            <p className="text-small text-text-muted">
              Endpoint: https://your-splunk-instance.com:8089
              <br />
              API Key: Generate in Splunk Settings {'>'} Tokens
            </p>
          </div>

          <div>
            <h3 className="text-h3 font-medium text-cyber-primary mb-sm">Elasticsearch/ELK</h3>
            <p className="text-small text-text-muted">
              Endpoint: https://your-elasticsearch-instance:9200
              <br />
              API Key: Generate in Kibana {'>'} Stack Management
            </p>
          </div>

          <div>
            <h3 className="text-h3 font-medium text-cyber-primary mb-sm">Wazuh</h3>
            <p className="text-small text-text-muted">
              Endpoint: https://your-wazuh-manager:55000
              <br />
              API Key: Generate in Wazuh API settings
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
