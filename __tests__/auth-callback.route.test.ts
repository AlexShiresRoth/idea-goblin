// @vitest-environment node
import { createServerClient } from "@supabase/ssr";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession, verifyOtp, cookieStore } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  cookieStore: { getAll: vi.fn(() => []), set: vi.fn() },
}));

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { exchangeCodeForSession, verifyOtp },
  })),
}));

import { GET } from "@/app/auth/callback/route";

function callback(query: string, headers: Record<string, string> = {}) {
  return GET(
    new Request(`http://internal.host/auth/callback${query}`, { headers }),
  );
}

function location(response: Response) {
  return new URL(response.headers.get("location")!);
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("signs in and goes to the board by default", async () => {
    const response = await callback("?code=abc");

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.status).toBe(307);
    expect(location(response).href).toBe("http://internal.host/main");
  });

  it("follows a same-origin next path", async () => {
    const response = await callback("?code=abc&next=/main/analysis");

    expect(location(response).pathname).toBe("/main/analysis");
    expect(location(response).host).toBe("internal.host");
  });

  it.each([
    ["a protocol-relative URL", "//evil.com/steal"],
    ["an absolute URL", "https://evil.com"],
    ["a relative path", "evil"],
  ])("never redirects to %s", async (_label, next) => {
    const response = await callback(
      `?code=abc&next=${encodeURIComponent(next)}`,
    );

    expect(location(response).href).toBe("http://internal.host/main");
  });

  it("uses the host the browser saw behind a proxy", async () => {
    const response = await callback("?code=abc", {
      "x-forwarded-host": "ideagoblin.app",
      "x-forwarded-proto": "https",
    });

    expect(location(response).href).toBe("https://ideagoblin.app/main");
  });

  it("defaults the forwarded protocol to https", async () => {
    const response = await callback("?code=abc", {
      "x-forwarded-host": "ideagoblin.app",
    });

    expect(location(response).protocol).toBe("https:");
  });

  it("sends a provider error to the error page without exchanging", async () => {
    const response = await callback(
      "?error=access_denied&error_description=User%20cancelled",
    );

    expect(location(response).pathname).toBe("/auth/auth-code-error");
    expect(location(response).searchParams.get("reason")).toBe(
      "User cancelled",
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("reports a missing code", async () => {
    const response = await callback("");

    expect(location(response).searchParams.get("reason")).toBe("missing_code");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("reports a failed exchange", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: "Code expired" },
    });

    const response = await callback("?code=abc");

    expect(location(response).pathname).toBe("/auth/auth-code-error");
    expect(location(response).searchParams.get("reason")).toBe("Code expired");
  });

  it("verifies an email token hash and follows next", async () => {
    const response = await callback(
      "?token_hash=hash&type=recovery&next=/auth/update-password",
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "hash",
    });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(location(response).pathname).toBe("/auth/update-password");
  });

  it("rejects a token hash with an unknown type", async () => {
    const response = await callback("?token_hash=hash&type=invite");

    expect(location(response).searchParams.get("reason")).toBe("missing_code");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("reports a failed token verification", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "Token expired" } });

    const response = await callback("?token_hash=hash&type=email");

    expect(location(response).searchParams.get("reason")).toBe("Token expired");
  });

  it("puts session cookies on both the cookie store and the redirect", async () => {
    exchangeCodeForSession.mockImplementation(async () => {
      const { cookies } = vi.mocked(createServerClient).mock.calls[0][2];
      cookies.setAll!(
        [{ name: "sb-session", value: "token", options: { path: "/" } }],
        { "Cache-Control": "private, no-store" },
      );
      return { error: null };
    });

    const response = await callback("?code=abc");

    expect(cookieStore.set).toHaveBeenCalledWith("sb-session", "token", {
      path: "/",
    });
    expect(response.headers.get("set-cookie")).toContain("sb-session=token");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
