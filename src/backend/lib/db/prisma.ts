import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) return url;
  const hasQuery = url.includes("?");
  const append = (u: string, keyValue: string) => `${u}${u.includes("?") ? "&" : "?"}${keyValue}`;

  // Supabase requires SSL; ensure it's present unless user already set it.
  const hasSsl =
    /(^|[?&])sslmode=/.test(url) ||
    /(^|[?&])ssl=/.test(url) ||
    /(^|[?&])sslaccept=/.test(url);
  const withSsl = hasSsl ? url : append(url, "sslmode=require");

  // Reduce connection pressure in serverless environments.
  const withLimit = withSsl.includes("connection_limit=") ? withSsl : append(withSsl, "connection_limit=1");

  return withLimit;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: getDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"]
  });

// Always use singleton pattern to prevent multiple Prisma instances
// This is critical in serverless environments like Vercel
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

// Properly disconnect on process termination
if (typeof process !== "undefined") {
  process.on("beforeExit", async () => {
    await prisma.$disconnect();
  });
}
