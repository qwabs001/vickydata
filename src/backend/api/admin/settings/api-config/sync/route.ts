import { NextResponse } from "next/server";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { dataProviderService } from "@/backend/services/dataProvider/dataProviderService";

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const configId = body?.configId ?? undefined;
    const rawMarkup = body?.markupPercent;
    const markupPercent = typeof rawMarkup === "number"
      ? rawMarkup
      : typeof rawMarkup === "string" && rawMarkup.trim() !== ""
        ? parseFloat(rawMarkup)
        : undefined;
    const networkMarkups =
      body?.networkMarkups && typeof body.networkMarkups === "object"
        ? (body.networkMarkups as Record<string, number>)
        : undefined;
    const planMarkups =
      body?.planMarkups && typeof body.planMarkups === "object"
        ? (body.planMarkups as Record<string, number>)
        : undefined;

    console.log("[sync route] markupPercent:", markupPercent, "planMarkups keys:", planMarkups ? Object.keys(planMarkups).length : 0);
    const networksToImport = Array.isArray(body?.networksToImport)
      ? body.networksToImport.filter((n: unknown): n is string => typeof n === "string")
      : undefined;
    const servicesToImport = Array.isArray(body?.servicesToImport)
      ? body.servicesToImport
          .filter((s: unknown): s is { network: string; plan: string } =>
            s != null && typeof (s as { network?: string }).network === "string" && typeof (s as { plan?: string }).plan === "string"
          )
      : undefined;
    const networkLogos =
      body?.networkLogos && typeof body.networkLogos === "object"
        ? (body.networkLogos as Record<string, string>)
        : undefined;

    const result = await dataProviderService.syncNetworksAndPlans(configId, {
      markupPercent,
      networkMarkups,
      planMarkups,
      networksToImport,
      servicesToImport,
      networkLogos
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("API config sync error:", error);
    return NextResponse.json(
      { ok: false, networksAdded: 0, plansAdded: 0, error: "Sync failed." },
      { status: 500 }
    );
  }
}
