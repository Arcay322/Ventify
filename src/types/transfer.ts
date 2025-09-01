import { Timestamp } from 'firebase/firestore';

export type TransferStatus = 'pending' | 'approved' | 'rejected' | 'in_transit' | 'completed';

export interface TransferProduct {
  productId: string;
  quantity: number;
  name: string;
  sku: string;
  category: string;
}

export interface Transfer {
  id?: string;
  accountId: string;
  sourceBranchId: string;
  destinationBranchId: string;
  products: TransferProduct[];
  status: TransferStatus;
  notes?: string;
  
  // Request information
  requestedBy: string;
  requestedAt: Timestamp;
  
  // Approval information
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectionReason?: string;
  
  // Shipping information
  shippedAt?: Timestamp;
  
  // Completion information
  completedAt?: Timestamp;
  receivedBy?: string;
}

export interface TransferRequest {
  accountId: string;
  sourceBranchId: string;
  destinationBranchId: string;
  products: TransferProduct[];
  notes?: string;
  requestedBy: string;
}