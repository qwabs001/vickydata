const DEFAULT_APP_URL =
  process.env.APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://vickydata.com";

function isLocalhostUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1";
  } catch {
    return (
      value.includes("localhost") ||
      value.includes("127.0.0.1") ||
      value.includes("0.0.0.0")
    );
  }
}

function normalizeUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function resolveAppUrl(request: Request, fallback: string = DEFAULT_APP_URL): string {
  const isVercel = Boolean(process.env.VERCEL_URL);

  const envUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.trim()) {
    const url = normalizeUrl(envUrl.trim());
    if (!isLocalhostUrl(url)) return url;
    if (isVercel) return fallback;
    return url;
  }

  if (isVercel) {
    const vercelUrl = process.env.VERCEL_URL?.trim();
    if (vercelUrl) {
      return `https://${vercelUrl.replace(/^https?:\/\//, "").split("/")[0]}`;
    }
  }

  const originHeader = request.headers.get("origin") ?? "";
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const inferred = originHeader || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : "");
  const normalized = inferred ? normalizeUrl(inferred) : "";

  if (normalized && !isLocalhostUrl(normalized)) return normalized;
  if (normalized && isLocalhostUrl(normalized) && isVercel) return fallback;

  return fallback;
}
