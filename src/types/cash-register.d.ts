export type CashRegisterSession = {
  id: string;
  branchId: string;
  accountId: string;
  initialAmount: number;
  openTime: number; // as timestamp
  closeTime?: number; // as timestamp
  status: 'open' | 'closed';
  
  // Ventas reales (productos entregados)
  totalSales: number;
  cashSales: number;
  cardSales: number;
  digitalSales: number;

  // Depósitos de reservas (dinero recibido pero productos no entregados aún)
  totalReservationDeposits?: number;
  cashReservationDeposits?: number;
  cardReservationDeposits?: number;
  digitalReservationDeposits?: number;
  reservationDepositsCount?: number;

  expectedAmount?: number;
  countedAmount?: number;
  difference?: number;
};
