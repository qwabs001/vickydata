import type { RewardsTransaction } from "@/shared/types";

export type RewardsState = {
  transactions: RewardsTransaction[];
};

const STORAGE_KEY = "keldatagh.rewards.state";

const seedTransactions: RewardsTransaction[] = [
  {
    id: "rw_1",
    type: "EARNED",
    amount: 1200,
    description: "Earned (Cashback)",
    referenceNumber: "#ORD-98231",
    createdAt: "2023-10-12T14:32:00.000Z"
  },
  {
    id: "rw_2",
    type: "WITHDRAWN",
    amount: 2000,
    description: "Withdrawn (MoMo)",
    referenceNumber: "WD-554109",
    createdAt: "2023-10-10T09:15:00.000Z"
  },
  {
    id: "rw_3",
    type: "EARNED",
    amount: 900,
    description: "Referral Bonus",
    referenceNumber: "User: Ama_Osei",
    createdAt: "2023-10-08T18:45:00.000Z"
  },
  {
    id: "rw_4",
    type: "SPENT",
    amount: 390.5,
    description: "Spent on Bundle",
    referenceNumber: "#ORD-97122",
    createdAt: "2023-10-05T11:02:00.000Z"
  },
  {
    id: "rw_5",
    type: "EARNED",
    amount: 740.5,
    description: "Earned (Cashback)",
    referenceNumber: "#ORD-96788",
    createdAt: "2023-09-28T08:05:00.000Z"
  }
];

export const loadRewardsState = (): RewardsState => {
  if (typeof window === "undefined") {
    return { transactions: seedTransactions };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { transactions: seedTransactions };
  }
  try {
    const parsed = JSON.parse(raw) as RewardsState;
    if (!parsed.transactions?.length) {
      return { transactions: seedTransactions };
    }
    return parsed;
  } catch {
    return { transactions: seedTransactions };
  }
};

export const saveRewardsState = (state: RewardsState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};
