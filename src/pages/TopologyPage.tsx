import { useState } from 'react';
import { Network, Server, Shield, AlertTriangle, CheckCircle, X } from 'lucide-react';

type Node = {
  id: string;
  name: string;
  type: 'server' | 'firewall' | 'endpoint' | 'router';
  ip: string;
  status: 'healthy' | 'warning' | 'compromised';
  os?: string;
};

const nodes: Node[] = [
  { id: '1', name: 'Core Router', type: 'router', ip: '10.0.0.1', status: 'healthy' },
  { id: '2', name: 'Primary Firewall', type: 'firewall', ip: '10.0.0.2', status: 'healthy' },
  { id: '3', name: 'Web Server 01', type: 'server', ip: '10.0.0.15', status: 'compromised', os: 'Ubuntu 22.04' },
  { id: '4', name: 'Database Server', type: 'server', ip: '10.0.0.22', status: 'warning', os: 'CentOS 8' },
  { id: '5', name: 'App Server 01', type: 'server', ip: '10.0.0.31', status: 'healthy', os: 'Debian 11' },
  { id: '6', name: 'Endpoint WS-044', type: 'endpoint', ip: '10.0.0.44', status: 'compromised', os: 'Windows 11' },
  { id: '7', name: 'Endpoint WS-055', type: 'endpoint', ip: '10.0.0.55', status: 'warning', os: 'Windows 10' },
  { id: '8', name: 'Backup Server', type: 'server', ip: '10.0.0.100', status: 'healthy', os: 'FreeBSD 13' },
];

export default function TopologyPage() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compromised': return 'text-status-critical';
      case 'warning': return 'text-status-warning';
      default: return 'text-status-success';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'compromised': return 'bg-status-critical/20 border-status-critical shadow-critical';
      case 'warning': return 'bg-status-warning/20 border-status-warning';
      default: return 'bg-status-success/20 border-status-success';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'firewall': return Shield;
      case 'router': return Network;
      default: return Server;
    }
  };

  return (
    <div className="flex gap-md h-full">
      {/* Graph View */}
      <div className="flex-1 bg-bg-surface border border-border-subtle rounded-lg p-md">
        <div className="flex items-center gap-sm mb-md">
          <Network size={18} className="text-cyber-primary" />
          <h1 className="text-h1 font-semibold text-text-main">Network Topology</h1>
        </div>
        
        <div className="relative h-[calc(100%-60px)] bg-bg-base rounded-lg overflow-hidden">
          {/* Grid background */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }} />
          
          {/* Connection lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <line x1="50%" y1="10%" x2="50%" y2="25%" stroke="#333" strokeWidth="2" />
            <line x1="50%" y1="25%" x2="25%" y2="45%" stroke="#333" strokeWidth="2" />
            <line x1="50%" y1="25%" x2="50%" y2="45%" stroke="#333" strokeWidth="2" />
            <line x1="50%" y1="25%" x2="75%" y2="45%" stroke="#333" strokeWidth="2" />
            <line x1="25%" y1="45%" x2="15%" y2="70%" stroke="#FF2A2A" strokeWidth="2" strokeDasharray="5,5" />
            <line x1="25%" y1="45%" x2="35%" y2="70%" stroke="#333" strokeWidth="2" />
            <line x1="75%" y1="45%" x2="65%" y2="70%" stroke="#FF9F0A" strokeWidth="2" strokeDasharray="5,5" />
            <line x1="75%" y1="45%" x2="85%" y2="70%" stroke="#333" strokeWidth="2" />
          </svg>

          {/* Nodes */}
          {nodes.map((node, i) => {
            const Icon = getIcon(node.type);
            const positions = [
              { left: '50%', top: '10%' },
              { left: '50%', top: '25%' },
              { left: '25%', top: '45%' },
              { left: '50%', top: '45%' },
              { left: '75%', top: '45%' },
              { left: '15%', top: '70%' },
              { left: '35%', top: '70%' },
              { left: '65%', top: '70%' },
              { left: '85%', top: '70%' },
            ];
            const pos = positions[i] || { left: '50%', top: '50%' };
            
            return (
              <button
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 p-sm rounded-lg border transition-all hover:scale-110 ${getStatusBg(node.status)} ${
                  selectedNode?.id === node.id ? 'ring-2 ring-cyber-primary' : ''
                }`}
                style={{ left: pos.left, top: pos.top }}
              >
                <Icon size={24} className={getStatusColor(node.status)} />
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-xs text-text-muted">{node.name}</span>
                </div>
              </button>
            );
          })}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-bg-surface/90 backdrop-blur rounded-md p-sm text-xs space-y-xs">
            <div className="flex items-center gap-sm">
              <span className="w-3 h-3 rounded-full bg-status-success" />
              <span className="text-text-muted">Healthy</span>
            </div>
            <div className="flex items-center gap-sm">
              <span className="w-3 h-3 rounded-full bg-status-warning" />
              <span className="text-text-muted">Warning</span>
            </div>
            <div className="flex items-center gap-sm">
              <span className="w-3 h-3 rounded-full bg-status-critical animate-pulse" />
              <span className="text-text-muted">Compromised</span>
            </div>
          </div>
        </div>
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div className="w-80 bg-bg-surface border border-border-subtle rounded-lg overflow-hidden">
          <div className="p-md border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-h2 font-medium text-text-main">Node Details</h2>
            <button onClick={() => setSelectedNode(null)} className="text-text-muted hover:text-text-main">
              <X size={18} />
            </button>
          </div>
          
          <div className="p-md space-y-md">
            <div className="flex items-center gap-md">
              {(() => { const Icon = getIcon(selectedNode.type); return <Icon size={32} className={getStatusColor(selectedNode.status)} />; })()}
              <div>
                <h3 className="text-body font-medium text-text-main">{selectedNode.name}</h3>
                <span className={`text-small ${getStatusColor(selectedNode.status)}`}>
                  {selectedNode.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-md text-small">
              <div>
                <span className="text-text-muted">IP Address</span>
                <p className="text-cyber-primary font-mono">{selectedNode.ip}</p>
              </div>
              <div>
                <span className="text-text-muted">Type</span>
                <p className="text-text-main capitalize">{selectedNode.type}</p>
              </div>
              {selectedNode.os && (
                <div className="col-span-2">
                  <span className="text-text-muted">Operating System</span>
                  <p className="text-text-main">{selectedNode.os}</p>
                </div>
              )}
            </div>

            {selectedNode.status !== 'healthy' && (
              <div className={`rounded-md p-sm border ${
                selectedNode.status === 'compromised' ? 'bg-status-critical/10 border-status-critical/30' : 'bg-status-warning/10 border-status-warning/30'
              }`}>
                <div className="flex items-center gap-sm mb-sm">
                  <AlertTriangle size={16} className={getStatusColor(selectedNode.status)} />
                  <span className={`text-small font-medium ${getStatusColor(selectedNode.status)}`}>
                    {selectedNode.status === 'compromised' ? 'Active Threat' : 'Anomaly Detected'}
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  {selectedNode.status === 'compromised' 
                    ? 'This node shows signs of compromise. Immediate investigation recommended.'
                    : 'Unusual activity detected. Monitor closely.'}
                </p>
              </div>
            )}

            <div className="space-y-sm pt-md border-t border-border-subtle">
              <button className="w-full bg-cyber-primary/10 border border-cyber-primary/30 text-cyber-primary rounded-md py-sm text-small hover:bg-cyber-primary/20 transition-all">
                View Logs
              </button>
              {selectedNode.status === 'compromised' && (
                <button className="w-full bg-status-critical/10 border border-status-critical/30 text-status-critical rounded-md py-sm text-small hover:bg-status-critical/20 transition-all">
                  Isolate Node
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
