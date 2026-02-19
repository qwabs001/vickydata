export type OrderStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  amount: number;
  currency: string;
  recipientNumber: string;
  createdAt: string;
  paymentStatus?: PaymentStatus;
  failedReason?: string | null;
  network?: {
    id: string;
    name: string;
    displayName: string;
    logoUrl: string;
  };
  dataPlan?: {
    id: string;
    name: string;
    dataAmount: string;
    validity?: string | null;
  };
}
