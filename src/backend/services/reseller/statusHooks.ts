import { prisma } from "@/backend/lib/db/prisma";
import { mapToResellerStatus } from "@/backend/services/reseller/format";
import { enqueueOrderUpdatedWebhook, processPendingWebhookDeliveries } from "@/backend/services/reseller/webhooks";

export async function enqueueWebhookIfStatusChanged(orderId: string): Promise<void> {
  const externalOrder = await prisma.agentExternalOrder.findUnique({
    where: { orderId },
    include: {
      order: {
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          amount: true,
          currency: true
        }
      }
    }
  });

  if (!externalOrder || !externalOrder.order) return;

  const mappedStatus = mapToResellerStatus(
    externalOrder.order.status,
    externalOrder.order.paymentStatus
  );

  if (externalOrder.lastKnownStatus === mappedStatus) return;

  await enqueueOrderUpdatedWebhook({
    externalOrder,
    order: externalOrder.order
  });

  await processPendingWebhookDeliveries(10);
}
