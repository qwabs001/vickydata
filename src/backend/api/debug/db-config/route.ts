import { NextResponse } from "next/server";
import { requireAdmin } from "@/backend/lib/middleware/admin";

/**
 * Diagnostic endpoint to check database configuration (admin only)
 * Shows DATABASE_URL format without exposing the password
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const dbUrl = process.env.DATABASE_URL || "";
    const maskedUrl = dbUrl
      ? dbUrl.replace(/:([^:@]+)@/, ":****@") // Mask password
      : "NOT SET";

    const isVercel = process.env.VERCEL === "1";
    const isPgbouncer = dbUrl.includes("pgbouncer=true");
    const port = dbUrl.match(/:(\d+)\//)?.[1] || "unknown";
    const isPooler = dbUrl.includes("pooler.supabase.com");
    const isDirect = dbUrl.includes("db.") && dbUrl.includes(".supabase.co");
    const hasConnectionLimit = dbUrl.includes("connection_limit=");
    const hasSslMode = dbUrl.includes("sslmode=");

    return NextResponse.json({
      environment: isVercel ? "Vercel" : "Local/Other",
      databaseUrl: maskedUrl,
      configuration: {
        isPooler,
        isDirect,
        port,
        isTransactionMode: port === "6543" && isPgbouncer,
        isSessionMode: port === "5432",
        hasPgbouncer: isPgbouncer,
        hasConnectionLimit,
        hasSslMode
      },
      recommendation: isVercel && port !== "6543"
        ? "Use port 6543 with ?pgbouncer=true for Vercel serverless. See DATABASE_VERCEL_FIX.md"
        : port === "6543" && isPgbouncer
        ? "Configuration looks correct for Vercel"
        : "Check DATABASE_VERCEL_FIX.md for optimal configuration"
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to check config" },
      { status: 500 }
    );
  }
}
