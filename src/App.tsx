import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ThreatMonitorPage from '@/pages/ThreatMonitorPage';
import AlertsPage from '@/pages/AlertsPage';
import AnalysisPage from '@/pages/AnalysisPage';
import TopologyPage from '@/pages/TopologyPage';
import AdminPanel from '@/pages/AdminPanel';
import IntegrationsPage from '@/pages/IntegrationsPage';
import PcapInsightsPage from '@/pages/PcapInsightsPage';

function ProtectedRoute() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="animate-pulse text-cyber-primary">Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <div className="min-h-screen bg-bg-base">
      <Sidebar />
      <main className="ml-16 lg:ml-60 p-lg min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/threat-monitor" element={<ThreatMonitorPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/analysis/:id" element={<AnalysisPage />} />
            <Route path="/topology" element={<TopologyPage />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/pcap-insights" element={<PcapInsightsPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
