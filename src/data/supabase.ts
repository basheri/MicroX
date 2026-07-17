// Supabase clients (EP-02). Used for Storage (signed URLs) and, later, anything that
// benefits from PostgREST/RLS. Direct SQL goes through src/data/pool.ts instead.
// Keys come from env (SEC-008); the service-role client is server-only.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | undefined;

// Server-side client with the service-role key. Never import this into client code.
export function getSupabaseServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase service client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).",
      );
    }
    serviceClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return serviceClient;
}

// Test seam: inject a fake client so storage helpers can be unit-tested without Supabase.
export function setSupabaseServiceClient(client: SupabaseClient): void {
  serviceClient = client;
}
