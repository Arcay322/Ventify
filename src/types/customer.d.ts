export type Customer = {
  id: string;
  name: string;
  dni?: string;
  email?: string;
  phone?: string;
  totalPurchases: number;
  totalSpent: number;
  accountId?: string;
};
