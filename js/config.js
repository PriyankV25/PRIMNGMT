// ==============================================================================
// Supabase Client Configuration
// Exclusively uses the public Anon Key. Sensitive keys are kept in backend.
// ==============================================================================

const DEFAULT_SUPABASE_URL = 'https://nypswixefpidztdvcmbc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55cHN3aXhlZnBpZHp0ZHZjbWJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1Mzk5MTYsImV4cCI6MjEwOTExNTkxNn0.z8cKwmbs4drdoL20FQz6gC0T7xivcWg1M1BPjvrx95c';

export const SUPABASE_URL = localStorage.getItem('supabase_url') || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = localStorage.getItem('supabase_anon_key') || DEFAULT_SUPABASE_ANON_KEY;

let client = null;

export function getSupabase() {
  if (client) return client;
  if (!window.supabase) {
    console.error('Supabase client library not loaded from CDN.');
    return null;
  }
  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return client;
}
