import { prisma } from "@/backend/lib/db/prisma";

export type ActivityLogInput = {
  userId?: string | null;
  action: string;
  resource: string;
  category?: string;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

export const recordActivity = async (input: ActivityLogInput) => {
  try {
    const { userId, action, resource, category, details, ipAddress } = input;
    const payload = {
      ...(details ? details : {}),
      ...(category ? { category } : {})
    };

    await prisma.activityLog.create({
      data: {
        userId: userId ?? undefined,
        action,
        resource,
        details: Object.keys(payload).length > 0 ? payload : undefined,
        ipAddress: ipAddress ?? undefined
      }
    });
  } catch (error) {
    console.error("Activity log error:", error);
  }
};

export const getRequestIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? undefined;
  }
  return request.headers.get("x-real-ip") ?? undefined;
};
