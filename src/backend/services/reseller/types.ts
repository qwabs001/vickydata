export type ResellerOrderStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "canceled"
  | "refunded";

export type ResellerErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_SIGNATURE"
  | "INVALID_TIMESTAMP"
  | "REPLAY_REQUEST"
  | "RATE_LIMIT_EXCEEDED"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
  | "SERVICE_UNAVAILABLE"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export type ResellerErrorShape = {
  error: {
    code: ResellerErrorCode;
    message: string;
    details?: unknown;
  };
};

export type SignedWebhookPayload = {
  event: "order.updated";
  order_id: string;
  client_order_id: string;
  status: ResellerOrderStatus;
  amount: number;
  currency: string;
  timestamp: string;
};

export type WebhookDeliveryEnvelope = SignedWebhookPayload & {
  signature: string;
};
