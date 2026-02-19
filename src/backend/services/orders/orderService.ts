import { prisma } from "@/backend/lib/db/prisma";

const generateOrderNumber = () => `GH-${Date.now()}`;

export const orderService = {
  async createOrder(payload: {
    userId: string;
    networkId: string;
    dataPlanId: string;
    recipientNumber: string;
    amount: number;
    currency?: string;
    rewardToUse?: number;
    useWallet?: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      const existingOrders = await tx.order.count({
        where: { userId: payload.userId }
      });
      const user = await tx.user.findUnique({
        where: { id: payload.userId },
        select: { referredById: true, username: true }
      });

      const rewardsBalance = await tx.rewardsBalance.findUnique({
        where: { userId: payload.userId }
      });
      const rewardAvailable = rewardsBalance?.currentBalance ?? 0;
      let rewardToUse = payload.rewardToUse ?? 0;
      if (rewardToUse > 0) {
        if (rewardAvailable < 50) {
          throw new Error("Rewards must be at least GHS 50.00 to redeem.");
        }
        rewardToUse = Math.min(rewardToUse, rewardAvailable, payload.amount);
      } else {
        rewardToUse = 0;
      }

      const netAmount = Math.max(0, payload.amount - rewardToUse);
      const useWallet = Boolean(payload.useWallet);

      if (rewardToUse > 0) {
        const before = rewardAvailable;
        const after = Math.round((before - rewardToUse) * 100) / 100;
        await tx.rewardsBalance.upsert({
          where: { userId: payload.userId },
          create: {
            userId: payload.userId,
            totalEarned: rewardsBalance?.totalEarned ?? 0,
            totalSpent: rewardToUse,
            totalWithdrawn: rewardsBalance?.totalWithdrawn ?? 0,
            currentBalance: after
          },
          update: {
            totalSpent: { increment: rewardToUse },
            currentBalance: after
          }
        });
        await tx.rewardsTransaction.create({
          data: {
            userId: payload.userId,
            type: "SPENT",
            amount: rewardToUse,
            balanceBefore: before,
            balanceAfter: after,
            description: "Spent on bundle",
            referenceNumber: `SPT-${Date.now()}`
          }
        });
      }

      if (useWallet) {
        const wallet = await tx.walletBalance.findUnique({
          where: { userId: payload.userId }
        });
        const walletBalance = wallet?.currentBalance ?? 0;
        if (walletBalance < netAmount) {
          throw new Error("Insufficient wallet balance.");
        }
        const before = walletBalance;
        const after = Math.round((before - netAmount) * 100) / 100;
        await tx.walletBalance.upsert({
          where: { userId: payload.userId },
          create: {
            userId: payload.userId,
            totalAdded: wallet?.totalAdded ?? 0,
            totalSpent: netAmount,
            currentBalance: after
          },
          update: {
            totalSpent: { increment: netAmount },
            currentBalance: after
          }
        });
        await tx.walletTransaction.create({
          data: {
            userId: payload.userId,
            type: "SPENT",
            amount: netAmount,
            balanceBefore: before,
            balanceAfter: after,
            description: "Paid for bundle"
          }
        });
      }

      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: payload.userId,
          networkId: payload.networkId,
          dataPlanId: payload.dataPlanId,
          recipientNumber: payload.recipientNumber,
          amount: netAmount,
          currency: payload.currency ?? "GHS",
          status: useWallet ? "PROCESSING" : "PENDING",
          paymentStatus: useWallet ? "COMPLETED" : "PENDING",
          paymentMethod: useWallet ? "WALLET" : undefined,
          rewardUsed: rewardToUse
        }
      });

      // Rewards (referral + cashback) are granted ONLY when order is COMPLETED.
      // See orderService.grantRewardsForCompletedOrder() called from fulfillOrder success.

      return order;
    });
  },

  /** Grant referral + cashback rewards only when order is successfully completed by provider. */
  async grantRewardsForCompletedOrder(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { referredById: true, username: true } } }
    });
    if (!order || order.status !== "COMPLETED") return;

    const netAmount = order.amount;
    const user = order.user;

    await prisma.$transaction(async (tx) => {
      // Referral cashback (0.5%) to referrer
      if (user?.referredById && netAmount > 0) {
        const referralReward = Math.round(netAmount * 0.005 * 100) / 100;
        if (referralReward > 0) {
          const existing = await tx.rewardsBalance.findUnique({
            where: { userId: user.referredById }
          });
          const before = existing?.currentBalance ?? 0;
          const after = Math.round((before + referralReward) * 100) / 100;
          await tx.rewardsBalance.upsert({
            where: { userId: user.referredById },
            create: {
              userId: user.referredById,
              totalEarned: referralReward,
              totalSpent: 0,
              totalWithdrawn: 0,
              currentBalance: after
            },
            update: {
              totalEarned: { increment: referralReward },
              currentBalance: { increment: referralReward }
            }
          });
          await tx.rewardsTransaction.create({
            data: {
              userId: user.referredById,
              orderId: order.id,
              type: "EARNED",
              amount: referralReward,
              balanceBefore: before,
              balanceAfter: after,
              description: `Referral cashback (0.5%) from ${user.username ?? "referred user"}`,
              referenceNumber: `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`
            }
          });
        }
      }

      // Purchase cashback (1%) to buyer
      if (netAmount > 0) {
        const rewardEarned = Math.round(netAmount * 0.01 * 100) / 100;
        const existing = await tx.rewardsBalance.findUnique({
          where: { userId: order.userId }
        });
        const before = existing?.currentBalance ?? 0;
        const after = Math.round((before + rewardEarned) * 100) / 100;
        await tx.rewardsBalance.upsert({
          where: { userId: order.userId },
          create: {
            userId: order.userId,
            totalEarned: rewardEarned,
            totalSpent: existing?.totalSpent ?? 0,
            totalWithdrawn: existing?.totalWithdrawn ?? 0,
            currentBalance: after
          },
          update: {
            totalEarned: { increment: rewardEarned },
            currentBalance: { increment: rewardEarned }
          }
        });
        await tx.rewardsTransaction.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            type: "EARNED",
            amount: rewardEarned,
            balanceBefore: before,
            balanceAfter: after,
            description: "Cashback reward",
            referenceNumber: `RWD-${Date.now()}`
          }
        });
        await tx.order.update({
          where: { id: orderId },
          data: { rewardEarned }
        });
      }
    });
  },

  /** Refund rewardUsed and/or wallet when order fails — user should not lose funds if provider fails. */
  async refundFailedOrder(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });
    if (!order) return;

    const rewardUsed = order.rewardUsed ?? 0;
    const isWallet = order.paymentMethod === "WALLET";
    const amount = order.amount;

    await prisma.$transaction(async (tx) => {
      if (rewardUsed > 0) {
        const existing = await tx.rewardsBalance.findUnique({
          where: { userId: order.userId }
        });
        const before = existing?.currentBalance ?? 0;
        const after = Math.round((before + rewardUsed) * 100) / 100;
        await tx.rewardsBalance.upsert({
          where: { userId: order.userId },
          create: {
            userId: order.userId,
            totalEarned: 0,
            totalSpent: 0,
            totalWithdrawn: 0,
            currentBalance: after
          },
          update: {
            totalSpent: { decrement: rewardUsed },
            currentBalance: after
          }
        });
        await tx.rewardsTransaction.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            type: "ADJUSTED",
            amount: rewardUsed,
            balanceBefore: before,
            balanceAfter: after,
            description: "Refund: order failed after payment",
            referenceNumber: `REFUND-RWD-${Date.now()}`
          }
        });
      }

      if (isWallet && amount > 0) {
        const wallet = await tx.walletBalance.findUnique({
          where: { userId: order.userId }
        });
        const before = wallet?.currentBalance ?? 0;
        const after = Math.round((before + amount) * 100) / 100;
        await tx.walletBalance.upsert({
          where: { userId: order.userId },
          create: {
            userId: order.userId,
            totalAdded: amount,
            totalSpent: 0,
            currentBalance: after
          },
          update: {
            totalSpent: { decrement: amount },
            currentBalance: after
          }
        });
        await tx.walletTransaction.create({
          data: {
            userId: order.userId,
            type: "ADJUSTED",
            amount: amount,
            balanceBefore: before,
            balanceAfter: after,
            description: "Refund: order failed (provider could not deliver)"
          }
        });
      }
    });
  }
};
