import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Public routes that do not require an authenticated session.
 * Static assets and `_next/*` are excluded via the `matcher` below.
 */
const PUBLIC_PATHS = new Set<string>(["/login"]);
const PUBLIC_PREFIXES = ["/auth/"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env is missing, fail open for public paths and 500 for protected.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isPublicPath(url.pathname)) return response;
    return new NextResponse("Supabase env not configured", { status: 500 });
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in users hitting /login go straight to the app.
  if (user && url.pathname === "/login") {
    const dest = url.clone();
    dest.pathname = "/dashboard";
    dest.search = "";
    return NextResponse.redirect(dest);
  }

  // Signed-out users hitting protected routes get bounced to /login.
  if (!user && !isPublicPath(url.pathname)) {
    const dest = url.clone();
    dest.pathname = "/login";
    dest.search = "";
    if (url.pathname !== "/") {
      dest.searchParams.set("next", url.pathname + url.search);
    }
    return NextResponse.redirect(dest);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - _next/static, _next/image, favicon, robots, sitemap
     *  - any file with an extension (e.g. .png, .svg, .css, .js)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
