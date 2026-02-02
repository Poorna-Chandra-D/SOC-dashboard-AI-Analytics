import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tjbnyurvlmbywxjlfunf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqYm55dXJ2bG1ieXd4amxmdW5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTk2NDksImV4cCI6MjA4NTQ5NTY0OX0.PeGtY9YWb63x3NciX-xWwaidnLUUQitki4VfX9jNlC0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Threat = {
  id: string;
  source_ip: string;
  destination_ip: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  threat_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  payload: Record<string, unknown>;
  detected_at: string;
};

export type Alert = {
  id: string;
  threat_id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  source: string;
  ai_summary: string;
  recommended_action: string;
  created_at: string;
};
