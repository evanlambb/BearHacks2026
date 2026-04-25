"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

export type SupabaseBrowserClient = ReturnType<
  typeof createBrowserClient<Database>
>;

let cached: SupabaseBrowserClient | null = null;

/**
 * Browser Supabase client. Auth-safe — uses the public anon key and respects
 * Row Level Security. Safe to import from client components.
 */
export function getSupabaseBrowser(): SupabaseBrowserClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
    );
  }

  cached = createBrowserClient<Database>(url, anonKey);
  return cached;
}
