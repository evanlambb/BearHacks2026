import "server-only";

import { redirect } from "next/navigation";

import { getSupabaseServer } from "./supabase/server";

/**
 * Resolve the current user on the server. Redirects to /login if absent.
 * Use inside protected layouts / pages / server actions.
 */
export async function requireUser() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { user, supabase };
}

export async function getOptionalUser() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, supabase };
}
