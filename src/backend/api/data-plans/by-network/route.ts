import { NextResponse } from "next/server";
import { dataPlanService } from "@/backend/services/dataPlans/dataPlanService";
import {
  resolveAgentPrice,
  getAgentPricingContext
} from "@/backend/services/agentPricingService";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const networkId = searchParams.get("networkId");
  const requesterId = searchParams.get("userId");
  if (!networkId) {
    return NextResponse.json({ error: "networkId is required" }, { status: 400 });
  }
  const pricingContext = await getAgentPricingContext(requesterId);
  try {
    const plans = await dataPlanService.listActiveByNetwork(networkId);
    const pricedPlans = pricingContext.isAgent
      ? plans.map((plan) => ({
          ...plan,
          price: resolveAgentPrice(plan.price, plan.agentPrice, pricingContext.discountPercent)
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
  } catch {
    const fallback = [
      {
        id: "plan_2gb",
        networkId,
        name: "2GB",
        dataAmount: "2GB",
        dataInMB: 2048,
        price: 10,
        currency: "GHS",
        validity: "30 days",
        isActive: true,
        isFeatured: false,
        sortOrder: 1
      },
      {
        id: "plan_5gb",
        networkId,
        name: "5GB",
        dataAmount: "5GB",
        dataInMB: 5120,
        price: 20,
        currency: "GHS",
        validity: "30 days",
        isActive: true,
        isFeatured: true,
        sortOrder: 2
      },
      {
        id: "plan_10gb",
        networkId,
        name: "10GB",
        dataAmount: "10GB",
        dataInMB: 10240,
        price: 30,
        currency: "GHS",
        validity: "30 days",
        isActive: true,
        isFeatured: false,
        sortOrder: 3
      },
      {
        id: "plan_15gb",
        networkId,
        name: "15GB",
        dataAmount: "15GB",
        dataInMB: 15360,
        price: 40,
        currency: "GHS",
        validity: "30 days",
        isActive: true,
        isFeatured: false,
        sortOrder: 4
      }
    ];
    const pricedFallback = pricingContext.isAgent
      ? fallback.map((plan) => ({
          ...plan,
          price: resolveAgentPrice(plan.price, null, pricingContext.discountPercent)
        }))
      : fallback;
    return NextResponse.json(pricedFallback);
  }
}
