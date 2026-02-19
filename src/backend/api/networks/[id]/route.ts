import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { networkService } from "@/backend/services/networks/networkService";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { getRequestIp, recordActivity } from "@/backend/lib/activityLog";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
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
    if (error.code === "P2025") {
      return { status: 404, message: "Network not found." };
    }
  }
  return null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }
    const userId = request.headers.get("x-user-id");
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid network payload." }, { status: 400 });
    }

    const network = await networkService.update(id, parsed.data);
    await recordActivity({
      userId,
      action: "Updated network",
      resource: network.displayName ?? network.name ?? id,
      category: "Settings",
      ipAddress: getRequestIp(request)
    });

    return NextResponse.json(network);
  } catch (error) {
    console.error("Network update error:", error);
    const mapped = mapNetworkError(error);
    if (mapped) {
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
    return NextResponse.json({ error: "Unable to update network." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }
    const userId = request.headers.get("x-user-id");
    const { id } = await context.params;
    await networkService.removeCascade(id);
    await recordActivity({
      userId,
      action: "Deleted network",
      resource: id,
      category: "Settings",
      ipAddress: getRequestIp(request)
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Network delete error:", error);
    const mapped = mapNetworkError(error);
    if (mapped) {
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
    return NextResponse.json({ error: "Unable to delete network." }, { status: 500 });
  }
}
