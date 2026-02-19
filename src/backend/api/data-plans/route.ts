import { NextResponse } from "next/server";
import { z } from "zod";
import { dataPlanService } from "@/backend/services/dataPlans/dataPlanService";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { getRequestIp, recordActivity } from "@/backend/lib/activityLog";
import { isDatabaseConnectionError } from "@/backend/lib/utils/dbError";
import {
  applyAgentDiscount,
  getAgentPricingContext
} from "@/backend/services/agentPricingService";

const createSchema = z.object({
  networkId: z.string().min(1),
  name: z.string().min(1),
  dataAmount: z.string().optional(),
  dataInMB: z.number().optional(),
  price: z.number().nonnegative(),
  currency: z.string().optional(),
  validity: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().optional()
});

const parseDataInMb = (value: string) => {
  const match = value.match(/(\d+(?:\.\d+)?)\s*gb/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? Math.round(amount * 1024) : 0;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");
    const requesterId = searchParams.get("userId");
    const networkId = searchParams.get("networkId") ?? undefined;
    const featuredOnly =
      searchParams.get("featured") === "true" || searchParams.get("featured") === "1";
    const limitRaw = Number(searchParams.get("limit") ?? "0");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

    if (scope === "all") {
      const auth = await requireAdmin(request);
      if (!auth.ok) {
        return auth.response;
      }
      const plans = await prisma.dataPlan.findMany({
        where: networkId ? { networkId } : undefined,
        include: { network: true },
        orderBy: { sortOrder: "asc" }
      });
      return NextResponse.json(plans);
    }

    if (scope === "public" || featuredOnly || networkId) {
      const pricingContext = await getAgentPricingContext(requesterId);
      const plans = await prisma.dataPlan.findMany({
        where: {
          isActive: true,
          ...(featuredOnly ? { isFeatured: true } : {}),
          ...(networkId ? { networkId } : {})
        },
        include: { network: true },
        orderBy: { sortOrder: "asc" },
        take: limit
      });
      const pricedPlans = pricingContext.isAgent
        ? plans.map((plan) => ({
            ...plan,
            price: applyAgentDiscount(plan.price, pricingContext.discountPercent)
          }))
        : plans;
      const cacheHeader = pricingContext.isAgent
        ? "private, no-store"
        : "public, s-maxage=60, stale-while-revalidate=120";
      return NextResponse.json(pricedPlans, {
        headers: {
          "Cache-Control": cacheHeader
        }
      });
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error("Data plan fetch error:", error);
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch data plans." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }
    const userId = request.headers.get("x-user-id");
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data plan payload." }, { status: 400 });
    }

    const payload = parsed.data;
    const dataAmount = payload.dataAmount ?? payload.name;
    const dataInMB = payload.dataInMB ?? parseDataInMb(dataAmount);

    const plan = await dataPlanService.create({
      networkId: payload.networkId,
      name: payload.name,
      dataAmount,
      dataInMB,
      price: payload.price,
      currency: payload.currency,
      validity: payload.validity,
      description: payload.description,
      isActive: payload.isActive,
      isFeatured: payload.isFeatured,
      sortOrder: payload.sortOrder
    });

    await recordActivity({
      userId,
      action: "Created data plan",
      resource: plan.name,
      category: "Settings",
      ipAddress: getRequestIp(request)
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Data plan create error:", error);
    return NextResponse.json({ error: "Unable to create data plan." }, { status: 500 });
  }
}
