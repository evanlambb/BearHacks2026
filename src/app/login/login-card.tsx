"use client";

import { useState } from "react";

import { getSupabaseBrowser } from "@/lib/supabase/client";

type Provider = "google";

export function LoginCard({
  initialError,
  next,
}: {
  initialError?: string;
  next?: string;
}) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function signInWith(provider: Provider) {
    setError(null);
    setPending(provider);

    try {
      const supabase = getSupabaseBrowser();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      if (next && next.startsWith("/")) {
        redirectTo.searchParams.set("next", next);
      }

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo.toString(),
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setPending(null);
      }
      // On success the browser is redirected to the OAuth provider.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div
          role="alert"
          className="rounded-[var(--radius-md)] border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-muted)] px-3 py-2 text-[12px] leading-snug text-[color:var(--color-danger)]"
        >
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => signInWith("google")}
        disabled={pending !== null}
        className="btn btn-secondary w-full"
        aria-busy={pending === "google"}
      >
        {pending === "google" ? (
          <Spinner />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        <span>
          {pending === "google" ? "Redirecting…" : "Continue with Google"}
        </span>
      </button>

      <div className="flex items-center gap-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-ink-subtle)]">
        <span className="h-px flex-1 bg-[color:var(--color-border)]" />
        Secure OAuth via Supabase
        <span className="h-px flex-1 bg-[color:var(--color-border)]" />
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeOpacity="0.2"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.5 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.4 26.7 36 24 36c-5.3 0-9.7-3.5-11.3-8.3L6 32.4C9.3 39 16.1 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.2C41.8 35.4 44 30.1 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
