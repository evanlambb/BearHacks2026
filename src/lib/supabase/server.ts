import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { Database } from "./database.types";

export type SupabaseServerClient = ReturnType<
  typeof createServerClient<Database>
>;

/**
 * Server-side Supabase client bound to the caller's session via cookies.
 * Use this in Server Components, Route Handlers, and Server Actions to make
 * RLS-respecting queries on behalf of the signed-in user.
 */
export async function getSupabaseServer(): Promise<SupabaseServerClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `cookies().set` throws inside Server Components — safe to ignore
          // when middleware is responsible for refreshing the session.
        }
      },
    },
  });
}
