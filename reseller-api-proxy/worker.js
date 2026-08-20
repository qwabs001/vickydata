/**
 * GhBundle Reseller API Proxy
 *
 * Proxies requests to ghbundle.com/api/v1/* when agent IPs are blocked by Vercel Checkpoint.
 * Deploy to Cloudflare Workers (free tier). Agents use this URL instead of ghbundle.com.
 *
 * Usage: Set base URL to https://<your-worker>.<your-subdomain>.workers.dev/api/v1
 */

// Override via wrangler.toml [vars] TARGET_BASE_URL
const DEFAULT_TARGET = "https://ghbundle.com";

// Headers we forward from client (reseller auth + standard)
const FORWARD_HEADERS = [
  "authorization",
  "x-api-key",
  "x-signature",
  "x-timestamp",
  "x-nonce",
  "x-request-id",
  "content-type",
  "accept",
  "x-webhook-event",
  "x-webhook-id",
  "x-webhook-signature",
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only proxy /api/v1/* paths
    if (!url.pathname.startsWith("/api/v1/")) {
      return new Response("Not Found. Use /api/v1/* paths only.", { status: 404 });
    }

    const base = env.TARGET_BASE_URL || DEFAULT_TARGET;
    const targetUrl = `${base}${url.pathname}${url.search}`;

    // Build headers - forward auth headers and add X-Forwarded-* for original client
    const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const headers = new Headers();

    for (const name of FORWARD_HEADERS) {
      const val = request.headers.get(name);
      if (val) headers.set(name, val);
    }

    headers.set("x-forwarded-for", clientIp);
    headers.set("x-forwarded-proto", "https");
    headers.set("x-real-ip", clientIp);

    const init = {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      redirect: "follow",
    };

    try {
      const response = await fetch(targetUrl, init);

      // Copy response headers (exclude hop-by-hop)
      const resHeaders = new Headers();
      for (const [k, v] of response.headers.entries()) {
        const lower = k.toLowerCase();
        if (!["transfer-encoding", "connection", "keep-alive"].includes(lower)) {
          resHeaders.set(k, v);
        }
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: {
            code: "PROXY_ERROR",
            message: "Failed to reach GhBundle API. Please retry.",
            details: { cause: err?.message || String(err) },
          },
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
