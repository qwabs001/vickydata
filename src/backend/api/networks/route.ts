import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { networkService } from "@/backend/services/networks/networkService";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { getRequestIp, recordActivity } from "@/backend/lib/activityLog";

const createSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  logoUrl: z.string().min(1).optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional()
});

const mapNetworkError = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { status: 503, message: "Database unavailable. Check the connection string." };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return { status: 409, message: "Network name already exists." };
    }
  }
  return null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");

    if (scope === "all") {
      const auth = await requireAdmin(request);
      if (!auth.ok) {
        return auth.response;
      }
      const networks = await prisma.network.findMany({
        include: { _count: { select: { dataPlans: true } } },
        orderBy: { sortOrder: "asc" }
      });
      return NextResponse.json(
        networks.map((network) => ({
          ...network,
          planCount: network._count.dataPlans
        }))
      );
    }

    const networks = await networkService.listActive();
    return NextResponse.json(networks, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
      }
    });
  } catch {
    return NextResponse.json([
      {
        id: "network_mtn",
        name: "MTN",
        displayName: "MTN Ghana",
        logoUrl: "/images/networks/MTN-Logo.png",
        isActive: true,
        sortOrder: 1
      },
      {
        id: "network_vodafone",
        name: "Telecel",
        displayName: "Telecel Ghana",
        logoUrl: "/images/networks/Telecel.webp",
        isActive: true,
        sortOrder: 2
      },
      {
        id: "network_airtel",
        name: "AirtelTigo",
        displayName: "AirtelTigo Ghana",
        logoUrl: "/images/networks/airteltigo.png",
        isActive: true,
        sortOrder: 3
      }
    ]);
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
      return NextResponse.json({ error: "Invalid network payload." }, { status: 400 });
    }

    const { name, displayName, logoUrl, sortOrder, isActive } = parsed.data;
    const network = await networkService.create({
      name,
      displayName,
      logoUrl: logoUrl ?? "/images/networks/MTN-Logo.png",
      sortOrder,
      isActive
    });

    await recordActivity({
      userId,
      action: "Created network",
      resource: network.displayName ?? network.name,
      category: "Settings",
      ipAddress: getRequestIp(request)
    });

    return NextResponse.json(network);
  } catch (error) {
    console.error("Network create error:", error);
    const mapped = mapNetworkError(error);
    if (mapped) {
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
    return NextResponse.json({ error: "Unable to create network." }, { status: 500 });
  }
}
