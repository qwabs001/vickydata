import { prisma } from "@/backend/lib/db/prisma";

export const dataPlanService = {
  listActiveByNetwork(networkId: string) {
    return prisma.dataPlan.findMany({
      where: { networkId, isActive: true },
      orderBy: { sortOrder: "asc" }
    });
  },
  listAll(networkId?: string) {
    return prisma.dataPlan.findMany({
      where: networkId ? { networkId } : undefined,
      orderBy: { sortOrder: "asc" }
    });
  },
  create(data: {
    networkId: string;
    name: string;
    dataAmount: string;
    dataInMB: number;
    price: number;
    agentPrice?: number | null;
    currency?: string;
    validity?: string;
    description?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    sortOrder?: number;
  }) {
    return prisma.dataPlan.create({
      data: {
        networkId: data.networkId,
        name: data.name,
        dataAmount: data.dataAmount,
        dataInMB: data.dataInMB,
        price: data.price,
        agentPrice: data.agentPrice ?? null,
        currency: data.currency ?? "GHS",
        validity: data.validity,
        description: data.description,
        isActive: data.isActive ?? true,
        isFeatured: data.isFeatured ?? false,
        sortOrder: data.sortOrder ?? 0
      }
    });
  },
  update(
    id: string,
    data: Partial<{
      networkId: string;
      name: string;
      dataAmount: string;
      dataInMB: number;
      price: number;
      agentPrice: number | null;
      currency: string;
      validity: string;
      description: string;
      isActive: boolean;
      isFeatured: boolean;
      sortOrder: number;
    }>
  ) {
    return prisma.dataPlan.update({ where: { id }, data });
  },
  remove(id: string) {
    return prisma.dataPlan.delete({ where: { id } });
  }
};
