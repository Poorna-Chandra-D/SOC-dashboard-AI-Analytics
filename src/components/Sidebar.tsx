import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  ShieldAlert,
  Bell,
  Brain,
  Network,
  FileSearch,
  LogOut,
  Shield,
  Settings,
  Plug,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/threat-monitor', icon: ShieldAlert, label: 'Threat Monitor' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/analysis', icon: Brain, label: 'AI Analysis' },
  { to: '/pcap-insights', icon: FileSearch, label: 'PCAP Insights' },
  { to: '/topology', icon: Network, label: 'Topology' },
  { to: '/integrations', icon: Plug, label: 'Integrations' },
  { to: '/admin', icon: Settings, label: 'Admin' },
];

export default function Sidebar() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-16 lg:w-60 bg-bg-surface border-r border-border-subtle flex flex-col z-50">
      <div className="flex items-center gap-sm p-md border-b border-border-subtle">
        <Shield className="w-8 h-8 text-cyber-primary flex-shrink-0" />
        <span className="hidden lg:block text-h2 font-semibold text-text-main">SOC</span>
      </div>

      <nav className="flex-1 py-md">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-sm px-md py-sm mx-sm rounded-md transition-all ${
                isActive
                  ? 'bg-cyber-primary/10 text-cyber-primary border-l-2 border-cyber-primary'
                  : 'text-text-muted hover:text-text-main hover:bg-bg-elevated'
              }`
            }
          >
            <Icon size={20} className="flex-shrink-0" />
            <span className="hidden lg:block text-body">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-md border-t border-border-subtle">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-sm px-md py-sm w-full text-text-muted hover:text-status-critical hover:bg-status-critical/10 rounded-md transition-all"
        >
          <LogOut size={20} />
          <span className="hidden lg:block text-body">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
