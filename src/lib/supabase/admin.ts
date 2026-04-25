import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

export type SupabaseAdminClient = ReturnType<typeof createClient<Database>>;

/**
 * Service-role Supabase client. Bypasses RLS — must NEVER be imported from
 * a client component or shipped to the browser. The `server-only` import
 * above causes Next.js to fail the build if that ever happens.
 */
let cached: SupabaseAdminClient | null = null;

export function getSupabaseAdmin(): SupabaseAdminClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  cached = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return cached;
}
