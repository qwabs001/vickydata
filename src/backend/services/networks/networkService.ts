import { prisma } from "@/backend/lib/db/prisma";

export const networkService = {
  listActive() {
    return prisma.network.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" }
    });
  },
  listAll() {
    return prisma.network.findMany({
      orderBy: { sortOrder: "asc" }
    });
  },
  create(data: {
    name: string;
    displayName: string;
    logoUrl: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    return prisma.network.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        logoUrl: data.logoUrl,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true
      }
    });
  },
  update(
    id: string,
    data: Partial<{
      name: string;
      displayName: string;
      logoUrl: string;
      sortOrder: number;
      isActive: boolean;
    }>
  ) {
    return prisma.network.update({
      where: { id },
      data
    });
  },
  remove(id: string) {
    return prisma.network.delete({ where: { id } });
  },
  async removeCascade(id: string) {
    return prisma.$transaction([
      prisma.rewardsTransaction.deleteMany({ where: { order: { networkId: id } } }),
      prisma.transaction.deleteMany({ where: { order: { networkId: id } } }),
      prisma.order.deleteMany({ where: { networkId: id } }),
      prisma.dataPlan.deleteMany({ where: { networkId: id } }),
      prisma.apiConfiguration.deleteMany({ where: { networkId: id } }),
      prisma.network.delete({ where: { id } })
    ]);
  }
};
