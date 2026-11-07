
// ==============================================================================
// PRIMNGMT - Supabase Client Configuration
// Uses ONLY the public Supabase anon/publishable key.
// Never place the service-role key in frontend JavaScript.
// ==============================================================================

const DEFAULT_SUPABASE_URL =
  'https://lympakytxfknvqszeqpt.supabase.co';

const DEFAULT_SUPABASE_ANON_KEY =
  'sb_publishable_MuaJcfgSNzw7cNZePCfCUw_bMtx3cLR';

// Optional local overrides.
// These are browser-side settings, NOT secure environment variables.
function getStoredValue(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export const SUPABASE_URL = getStoredValue(
  'supabase_url',
  DEFAULT_SUPABASE_URL
);

export const SUPABASE_ANON_KEY = getStoredValue(
  'supabase_anon_key',
  DEFAULT_SUPABASE_ANON_KEY
);

let client = null;

export function getSupabase() {
  if (client) return client;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[PRIMNGMT] Supabase configuration is missing.');
    return null;
  }

  if (!window.supabase) {
    console.error(
      '[PRIMNGMT] Supabase library is not loaded. Check the CDN script in index.html.'
    );
    return null;
  }

  try {
    client = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    return client;
  } catch (error) {
    console.error('[PRIMNGMT] Supabase initialization failed:', error);
    return null;
  }
}
