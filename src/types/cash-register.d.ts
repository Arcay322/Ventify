export type CashRegisterSession = {
  id: string;
  initialAmount: number;
  openTime: number; // as timestamp
  closeTime?: number; // as timestamp
  status: 'open' | 'closed';
  
  totalSales: number;
  cashSales: number;
  cardSales: number;
  digitalSales: number;

  expectedAmount?: number;
  countedAmount?: number;
  difference?: number;
};
