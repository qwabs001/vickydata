import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPhone = "0200000000";
  const adminUsername = "Qwabs";
  const adminPassword = await bcrypt.hash("Enter#@123", 10);

  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [{ username: adminUsername }, { phoneNumber: adminPhone }]
    }
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        username: adminUsername,
        phoneNumber: adminPhone,
        password: adminPassword,
        role: "ADMIN",
        status: "ACTIVE"
      }
    });
  } else {
    await prisma.user.create({
      data: {
        username: adminUsername,
        phoneNumber: adminPhone,
        password: adminPassword,
        role: "ADMIN",
        status: "ACTIVE"
      }
    });
  }

  const networks = [
    {
      name: "MTN",
      displayName: "MTN Ghana",
      logoUrl: "/images/networks/MTN-Logo.png",
      sortOrder: 1
    },
    {
      name: "Telecel",
      displayName: "Telecel Ghana",
      logoUrl: "/images/networks/Telecel.webp",
      sortOrder: 2
    },
    {
      name: "AirtelTigo",
      displayName: "AirtelTigo Ghana",
      logoUrl: "/images/networks/airteltigo.png",
      sortOrder: 3
    }
  ];

  for (const network of networks) {
    await prisma.network.upsert({
      where: { name: network.name },
      update: {
        displayName: network.displayName,
        logoUrl: network.logoUrl,
        sortOrder: network.sortOrder,
        isActive: true
      },
      create: {
        name: network.name,
        displayName: network.displayName,
        logoUrl: network.logoUrl,
        sortOrder: network.sortOrder,
        isActive: true
      }
    });
  }

  const mtn = await prisma.network.findUnique({ where: { name: "MTN" } });
  const vodafone = await prisma.network.findUnique({ where: { name: "Telecel" } });
  const airtel = await prisma.network.findUnique({ where: { name: "AirtelTigo" } });

  const basePlans = [
    { name: "2GB", dataAmount: "2GB", dataInMB: 2048, price: 10, sortOrder: 1, isFeatured: false },
    { name: "5GB", dataAmount: "5GB", dataInMB: 5120, price: 20, sortOrder: 2, isFeatured: true },
    { name: "10GB", dataAmount: "10GB", dataInMB: 10240, price: 30, sortOrder: 3, isFeatured: false },
    { name: "15GB", dataAmount: "15GB", dataInMB: 15360, price: 40, sortOrder: 4, isFeatured: false }
  ];

  const networksWithIds = [mtn, vodafone, airtel].filter(Boolean);

  for (const network of networksWithIds) {
    for (const plan of basePlans) {
      await prisma.dataPlan.upsert({
        where: { networkId_name: { networkId: network!.id, name: plan.name } },
        update: {
          dataAmount: plan.dataAmount,
          dataInMB: plan.dataInMB,
          price: plan.price,
          validity: "30 days",
          isFeatured: plan.isFeatured,
          sortOrder: plan.sortOrder,
          isActive: true
        },
        create: {
          networkId: network!.id,
          name: plan.name,
          dataAmount: plan.dataAmount,
          dataInMB: plan.dataInMB,
          price: plan.price,
          validity: "30 days",
          isFeatured: plan.isFeatured,
          sortOrder: plan.sortOrder,
          isActive: true
        }
      });
    }
  }

  await prisma.rewardsConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      rewardPercentage: 1,
      isActive: true,
      minPurchaseAmount: 0,
      minWithdrawalAmount: 5
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
