import { prisma } from "@/backend/lib/db/prisma";
import { getSmsSettings } from "@/backend/services/smsSettingsService";
import { sendSms, buildSmsMessage } from "@/backend/services/smsService";

/**
 * Send SMS when an order is completed.
 * Called after order status is set to COMPLETED.
 */
export async function sendOrderCompleteSms(orderId: string): Promise<void> {
  try {
    const settings = await getSmsSettings();
    if (!settings.enabled) return;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { phoneNumber: true } },
        dataPlan: true,
        network: true
      }
    });
    if (!order?.user?.phoneNumber) return;

    const message = buildSmsMessage(settings.orderCompleteTemplate, {
      orderNumber: order.orderNumber,
      planName: order.dataPlan?.name ?? "Data bundle",
      recipient: order.recipientNumber
    });
    if (!message) return;

    await sendSms(order.user.phoneNumber, message);
  } catch (err) {
    console.error("[SMS] Order complete notification error:", err);
  }
}

/**
 * Send SMS when wallet is topped up.
 * Called after wallet credit is recorded.
 */
export async function sendWalletTopUpSms(userId: string, amount: number, newBalance: number): Promise<void> {
  try {
    const settings = await getSmsSettings();
    if (!settings.enabled) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phoneNumber: true }
    });
    if (!user?.phoneNumber) return;

    const message = buildSmsMessage(settings.walletTopUpTemplate, {
      amount,
      balance: newBalance
    });
    if (!message) return;

    await sendSms(user.phoneNumber, message);
  } catch (err) {
    console.error("[SMS] Wallet top-up notification error:", err);
  }
}
