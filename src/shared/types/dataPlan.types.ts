export interface DataPlan {
  id: string;
  networkId: string;
  name: string;
  dataAmount: string;
  dataInMB: number;
  price: number;
  currency: string;
  validity?: string | null;
  description?: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
}
