import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) return url;
  const append = (u: string, keyValue: string) => `${u}${u.includes("?") ? "&" : "?"}${keyValue}`;

  let normalizedUrl = url.trim();

  // On Vercel, auto-upgrade Supabase session pooler URLs to transaction mode.
  // This prevents MaxClientsInSessionMode errors under serverless concurrency.
  const isVercel = process.env.VERCEL === "1";
  const isSupabasePooler = normalizedUrl.includes("pooler.supabase.com");
  const isSessionPooler = /pooler\.supabase\.com:5432\//.test(normalizedUrl);
  if (isVercel && isSupabasePooler && isSessionPooler) {
    normalizedUrl = normalizedUrl.replace("pooler.supabase.com:5432/", "pooler.supabase.com:6543/");
    if (!/(^|[?&])pgbouncer=/.test(normalizedUrl)) {
      normalizedUrl = append(normalizedUrl, "pgbouncer=true");
    }
    console.warn(
      "[Prisma] DATABASE_URL was set to Supabase session mode (5432) on Vercel. Auto-switched to 6543 + pgbouncer=true."
    );
  }

  // Supabase requires SSL; ensure it's present unless already set.
  const hasSsl =
    /(^|[?&])sslmode=/.test(normalizedUrl) ||
    /(^|[?&])ssl=/.test(normalizedUrl) ||
    /(^|[?&])sslaccept=/.test(normalizedUrl);
  const withSsl = hasSsl ? normalizedUrl : append(normalizedUrl, "sslmode=require");

  // Reduce connection pressure in serverless environments.
  // Use connection_limit=1 per function instance to minimize pool exhaustion
  const withLimit = withSsl.includes("connection_limit=") ? withSsl : append(withSsl, "connection_limit=1");

  // For pgbouncer transaction mode (port 6543), Prisma requires prepared_statements=false
  const isPgbouncerMode = withLimit.includes("pgbouncer=true") || withLimit.includes(":6543");
  const withPreparedStatements = isPgbouncerMode && !withLimit.includes("prepared_statements=")
    ? append(withLimit, "prepared_statements=false")
    : withLimit;

  // Warn if using direct connection or session mode (5432) on Vercel — use transaction mode (6543) instead
  if (process.env.VERCEL === "1") {
    if (normalizedUrl.includes("db.") && normalizedUrl.includes(".supabase.co")) {
      console.warn(
        "[Prisma] Use the pooler URL (pooler.supabase.com), not the direct db. URL. See DATABASE_VERCEL_FIX.md"
      );
    }
    if (normalizedUrl.includes("pooler.supabase.com:5432") && !normalizedUrl.includes("6543")) {
      console.warn(
        "[Prisma] Port 5432 (session mode) often causes 'Database temporarily unavailable' on Vercel. Use port 6543 with ?pgbouncer=true — see DATABASE_VERCEL_FIX.md"
      );
    }
  }

  return withPreparedStatements;
}

const dbUrl = getDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"]
  });

// Always use singleton pattern to prevent multiple Prisma instances
// This is critical in serverless environments like Vercel
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}
