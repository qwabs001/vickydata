import type { Order, OrderStatus, PaymentStatus } from "@prisma/client";
import type { ResellerOrderStatus } from "@/backend/services/reseller/types";

export function mapToResellerStatus(
  status: OrderStatus,
  paymentStatus?: PaymentStatus | null
): ResellerOrderStatus {
  if (status === "PENDING") return "pending";
  if (status === "PROCESSING") return "processing";
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED") {
    if (paymentStatus === "REFUNDED") return "refunded";
    return "canceled";
  }
  if (status === "FAILED") {
    if (paymentStatus === "REFUNDED") return "refunded";
    return "failed";
  }
  return "failed";
}

export function maskPhoneNumber(phone: string): string {
  const sanitized = phone.replace(/\s+/g, "");
  if (sanitized.length <= 6) return sanitized;
  const head = sanitized.slice(0, 3);
  const tail = sanitized.slice(-3);
  return `${head}${"*".repeat(Math.max(0, sanitized.length - 6))}${tail}`;
}

export function orderDateRange(from?: string | null, to?: string | null): {
  gte?: Date;
  lte?: Date;
} {
  const output: { gte?: Date; lte?: Date } = {};
  if (from) {
    const parsed = new Date(from);
    if (!Number.isNaN(parsed.getTime())) output.gte = parsed;
  }
  if (to) {
    const parsed = new Date(to);
    if (!Number.isNaN(parsed.getTime())) output.lte = parsed;
  }
  return output;
}

export function serializeOrderTimestamp(order: Pick<Order, "createdAt" | "updatedAt" | "completedAt">): {
  created_at: string;
  updated_at: string;
  completed_at: string | null;
} {
  return {
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
    completed_at: order.completedAt ? order.completedAt.toISOString() : null
  };
}
