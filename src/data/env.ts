// Server-side environment contract (EP-01). Centralises access to env vars so the
// rest of the app never reads process.env directly. Validation/connection happen in
// the epics that consume each value (Supabase EP-02, OpenRouter EP-06).
//
// Secrets come from Vercel environment variables, never the repo (SEC-008).

export interface ServerEnv {
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  supabaseServiceRoleKey: string | undefined;
  appEncryptionKey: string | undefined;
}

export function readServerEnv(): ServerEnv {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    appEncryptionKey: process.env.APP_ENCRYPTION_KEY,
  };
}
