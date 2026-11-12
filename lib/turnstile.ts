const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token: unknown, remoteIp?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (typeof token !== "string" || token.length < 1 || token.length > 2048 || !secret) {
    console.warn("[turnstile] Missing or invalid token/secret.");
    return false;
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const result = await response.json() as {
      success?: boolean;
      action?: string;
      hostname?: string;
      "error-codes"?: string[];
    };
    if (result.success !== true) {
      // Cloudflare error codes are safe to log and are essential for diagnosing
      // key, hostname, expired, or already-used token configuration problems.
      console.warn("[turnstile] Siteverify rejected token:", {
        errors: result["error-codes"] ?? [],
        hostname: result.hostname ?? null,
        action: result.action ?? null,
      });
      return false;
    }
    if (result.action !== "member_search") {
      console.warn("[turnstile] Unexpected action:", result.action ?? null);
      return false;
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl) {
      try {
        // Local .env files commonly use `localhost:3000` without a scheme.
        // `new URL()` rejects that value and used to turn every valid local
        // Turnstile response into a 403.
        const normalizedSiteUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(siteUrl)
          ? siteUrl
          : `http://${siteUrl}`;
        const expectedHost = new URL(normalizedSiteUrl).hostname;
        if (!/localhost|127\.0\.0\.1/i.test(expectedHost) && result.hostname !== expectedHost) {
          console.warn("[turnstile] Hostname mismatch:", { expectedHost, actualHost: result.hostname ?? null });
          return false;
        }
      } catch {
        console.warn("[turnstile] NEXT_PUBLIC_SITE_URL is not a valid URL.");
        return false;
      }
    }
    return true;
  } catch {
    console.warn("[turnstile] Siteverify request failed.");
    return false;
  }
}
