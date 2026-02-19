import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Starting database cleanup...");
  console.log("⚠️  This will delete ALL records except the admin user!\n");

  // Find admin user
  const adminUsername = "Opoku";
  const adminPhone = "0200000000";

  const adminUser = await prisma.user.findFirst({
    where: {
      OR: [{ username: adminUsername }, { phoneNumber: adminPhone }]
    }
  });

  if (!adminUser) {
    console.error("❌ Admin user not found! Cannot proceed.");
    process.exit(1);
  }

  console.log(`✅ Found admin user: ${adminUser.username} (${adminUser.id})\n`);

  // Delete in smaller transactions to avoid timeout
  console.log("📦 Deleting agent-related data...");
  await prisma.agentWebhookDelivery.deleteMany({
    where: { agentId: { not: adminUser.id } }
  });
  console.log("   ✓ Agent webhook deliveries deleted");

  await prisma.agentWebhookSubscription.deleteMany({
    where: { agentId: { not: adminUser.id } }
  });
  console.log("   ✓ Agent webhook subscriptions deleted");

  await prisma.agentExternalOrder.deleteMany({
    where: { agentId: { not: adminUser.id } }
  });
  console.log("   ✓ Agent external orders deleted");

  await prisma.agentApiRequestLog.deleteMany({
    where: { agentId: { not: adminUser.id } }
  });
  console.log("   ✓ Agent API request logs deleted");

  await prisma.agentApiNonce.deleteMany({
    where: { agentId: { not: adminUser.id } }
  });
  console.log("   ✓ Agent API nonces deleted");

  await prisma.agentApiCredential.deleteMany({
    where: { agentId: { not: adminUser.id } }
  });
  console.log("   ✓ Agent API credentials deleted");

  console.log("\n💰 Deleting financial data...");
  await prisma.withdrawalRequest.deleteMany({
    where: { userId: { not: adminUser.id } }
  });
  console.log("   ✓ Withdrawal requests deleted");

  await prisma.walletTransaction.deleteMany({
    where: { userId: { not: adminUser.id } }
  });
  console.log("   ✓ Wallet transactions deleted");

  await prisma.walletBalance.deleteMany({
    where: { userId: { not: adminUser.id } }
  });
  console.log("   ✓ Wallet balances deleted");

  await prisma.rewardsTransaction.deleteMany({
    where: { userId: { not: adminUser.id } }
  });
  console.log("   ✓ Rewards transactions deleted");

  await prisma.rewardsBalance.deleteMany({
    where: { userId: { not: adminUser.id } }
  });
  console.log("   ✓ Rewards balances deleted");

  await prisma.paymentIntent.deleteMany({
    where: { userId: { not: adminUser.id } }
  });
  console.log("   ✓ Payment intents deleted");

  await prisma.transaction.deleteMany({
    where: { userId: { not: adminUser.id } }
  });
  console.log("   ✓ Transactions deleted");

  console.log("\n🛒 Deleting orders...");
  await prisma.order.deleteMany({
    where: { userId: { not: adminUser.id } }
  });
  console.log("   ✓ Orders deleted");

  console.log("\n📋 Deleting data plans/services...");
  await prisma.dataPlan.deleteMany({});
  console.log("   ✓ Data plans deleted");

  console.log("\n👥 Deleting users (except admin)...");
  // Clear referral relationships first
  await prisma.user.updateMany({
    where: { referredById: { not: null } },
    data: { referredById: null }
  });
  console.log("   ✓ Referral relationships cleared");

  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { not: adminUser.id } }
  });
  console.log(`   ✓ ${deletedUsers.count} users deleted`);

  console.log("\n📝 Deleting activity logs...");
  const deletedLogs = await prisma.activityLog.deleteMany({});
  console.log(`   ✓ ${deletedLogs.count} activity logs deleted`);

  console.log("\n🔔 Cleaning notification reads...");
  try {
    await prisma.notificationRead.deleteMany({
      where: { userId: { not: adminUser.id } }
    });
    console.log("   ✓ Notification reads deleted");
  } catch (error: any) {
    if (error.code === "P2021") {
      console.log("   ⚠ Notification reads table doesn't exist, skipping");
    } else {
      throw error;
    }
  }

  // Reset admin user's related data
  console.log("\n🔄 Resetting admin user data...");
  // Reset admin wallet balance
  await prisma.walletBalance.upsert({
    where: { userId: adminUser.id },
    create: {
      userId: adminUser.id,
      totalAdded: 0,
      totalSpent: 0,
      currentBalance: 0
    },
    update: {
      totalAdded: 0,
      totalSpent: 0,
      currentBalance: 0
    }
  });
  console.log("   ✓ Admin wallet balance reset");

  // Reset admin rewards balance
  await prisma.rewardsBalance.upsert({
    where: { userId: adminUser.id },
    create: {
      userId: adminUser.id,
      totalEarned: 0,
      totalSpent: 0,
      totalWithdrawn: 0,
      currentBalance: 0
    },
    update: {
      totalEarned: 0,
      totalSpent: 0,
      totalWithdrawn: 0,
      currentBalance: 0
    }
  });
  console.log("   ✓ Admin rewards balance reset");

  // Ensure admin is active
  await prisma.user.update({
    where: { id: adminUser.id },
    data: {
      status: "ACTIVE",
      role: "ADMIN",
      referredById: null
    }
  });
  console.log("   ✓ Admin user status confirmed");

  console.log("\n✅ Database cleanup completed successfully!");
  console.log("\n📊 Summary:");
  console.log("   • All users deleted (except admin)");
  console.log("   • All data plans deleted");
  console.log("   • All orders deleted");
  console.log("   • All transactions deleted");
  console.log("   • All activity logs deleted");
  console.log("   • Admin user preserved and active");
  console.log("\n💡 Networks, Settings, and RewardsConfig were preserved.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("❌ Error during cleanup:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
