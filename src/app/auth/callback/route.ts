import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const errorParam = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (errorParam) {
    return NextResponse.redirect(
      buildLoginUrl(url, errorParam, safeNext),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      buildLoginUrl(url, "Missing OAuth code", safeNext),
    );
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      buildLoginUrl(url, error.message, safeNext),
    );
  }

  const dest = new URL(safeNext, url.origin);
  return NextResponse.redirect(dest);
}

function buildLoginUrl(base: URL, message: string, next: string): URL {
  const dest = new URL("/login", base.origin);
  dest.searchParams.set("error", message);
  if (next && next !== "/dashboard") dest.searchParams.set("next", next);
  return dest;
}
