export interface RewardsBalance {
  totalEarned: number;
  totalSpent: number;
  totalWithdrawn: number;
  currentBalance: number;
}

export type RewardsTransactionType =
  | "EARNED"
  | "SPENT"
  | "WITHDRAWN"
  | "EXPIRED"
  | "ADJUSTED";

export interface RewardsTransaction {
  id: string;
  type: RewardsTransactionType;
  amount: number;
  description: string;
  referenceNumber?: string;
  createdAt: string;
  /** Order amount (purchase) for referral transactions */
  orderAmount?: number;
  /** Username of referred user who made the purchase */
  referredUsername?: string | null;
}
