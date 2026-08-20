import { NextResponse } from "next/server";
import { GET as getMoolreStatus } from "@/backend/api/payments/moolre/status/route";

export async function GET(request: Request) {
  return getMoolreStatus(request);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const reference =
    typeof body?.reference === "string" && body.reference.trim().length > 0
      ? body.reference.trim()
      : typeof body?.ref === "string" && body.ref.trim().length > 0
        ? body.ref.trim()
        : "";

  if (!reference) {
    return NextResponse.json({ error: "Reference is required." }, { status: 400 });
  }

  const url = new URL(request.url);
  url.searchParams.set("ref", reference);
  return getMoolreStatus(new Request(url.toString(), { method: "GET" }));
}
