import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function safeNext(next: string | null) {
  // Only same-origin absolute paths; "//evil.com" is protocol-relative.
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/main";
}

function baseUrl(request: Request) {
  const { origin } = new URL(request.url);
  // Behind the load balancer `request.url` is the internal deployment host, so
  // prefer the host the browser actually used — the session cookies we are
  // about to set are scoped to it.
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (process.env.NODE_ENV === "development" || !forwardedHost) {
    return origin;
  }
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${forwardedProto}://${forwardedHost}`;
}

function errorRedirect(base: string, reason: string) {
  const url = new URL("/auth/auth-code-error", base);
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = baseUrl(request);

  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return errorRedirect(base, providerError);
  }

  const code = searchParams.get("code");

  if (!code) {
    return errorRedirect(base, "missing_code");
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(
    new URL(safeNext(searchParams.get("next")), base),
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Write to both the cookie store and the response: a `NextResponse`
          // we construct ourselves is not guaranteed to pick up mutations made
          // through `next/headers`, and losing these is a silent failed login.
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            response.cookies.set(name, value, options);
          });
          if (headers) {
            Object.entries(headers).forEach(([key, value]) =>
              response.headers.set(key, value),
            );
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return errorRedirect(base, error.message);
  }

  return response;
}
