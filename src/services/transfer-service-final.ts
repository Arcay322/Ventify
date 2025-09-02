import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Transfer, TransferRequest } from '@/types/transfer';

export class TransferService {
  static async createTransfer(transferRequest: TransferRequest): Promise<string> {
    try {
      const transferData = {
        accountId: transferRequest.accountId,
        sourceBranchId: transferRequest.sourceBranchId,
        destinationBranchId: transferRequest.destinationBranchId,
        products: transferRequest.products,
        status: 'pending' as const,
        notes: transferRequest.notes,
        requestedBy: transferRequest.requestedBy,
        requestedAt: serverTimestamp()
      };

      const transferRef = await addDoc(collection(db, 'transfers'), transferData);
      return transferRef.id;
    } catch (error) {
      console.error('Error creating transfer:', error);
      throw error;
    }
  }

  static async getTransfers(accountId: string, branchId?: string): Promise<Transfer[]> {
    try {
      const transfersRef = collection(db, 'transfers');
      let q = query(
        transfersRef, 
        where('accountId', '==', accountId),
        orderBy('requestedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          accountId: data.accountId,
          sourceBranchId: data.sourceBranchId,
          destinationBranchId: data.destinationBranchId,
          products: data.products || [],
          status: data.status,
          notes: data.notes,
          requestedBy: data.requestedBy,
          requestedAt: data.requestedAt,
          approvedBy: data.approvedBy,
          approvedAt: data.approvedAt,
          rejectionReason: data.rejectionReason,
          shippedAt: data.shippedAt,
          completedAt: data.completedAt,
          receivedBy: data.receivedBy
        } as Transfer;
      });
    } catch (error) {
      console.error('Error getting transfers:', error);
      throw error;
    }
  }

  static async updateTransferStatus(
    transferId: string,
    newStatus: Transfer['status'],
    userId: string,
    additionalData?: any
  ): Promise<void> {
    try {
      const transferRef = doc(db, 'transfers', transferId);
      const updateData: any = {
        status: newStatus
      };

      switch (newStatus) {
        case 'approved':
          updateData.approvedBy = userId;
          updateData.approvedAt = serverTimestamp();
          break;
        case 'rejected':
          updateData.rejectionReason = additionalData?.reason || 'Rechazada';
          break;
        case 'in_transit':
          updateData.shippedAt = serverTimestamp();
          break;
        case 'completed':
          updateData.completedAt = serverTimestamp();
          updateData.receivedBy = userId;
          // Aquí podríamos actualizar el stock automáticamente
          break;
      }

      await updateDoc(transferRef, updateData);
    } catch (error) {
      console.error('Error updating transfer status:', error);
      throw error;
    }
  }

  static async getTransferById(transferId: string): Promise<Transfer | null> {
    try {
      const transferRef = doc(db, 'transfers', transferId);
      const transferDoc = await getDoc(transferRef);
      
      if (!transferDoc.exists()) {
        return null;
      }

      const data = transferDoc.data();
      return {
        id: transferDoc.id,
        accountId: data.accountId,
        sourceBranchId: data.sourceBranchId,
        destinationBranchId: data.destinationBranchId,
        products: data.products || [],
        status: data.status,
        notes: data.notes,
        requestedBy: data.requestedBy,
        requestedAt: data.requestedAt,
        approvedBy: data.approvedBy,
        approvedAt: data.approvedAt,
        rejectionReason: data.rejectionReason,
        shippedAt: data.shippedAt,
        completedAt: data.completedAt,
        receivedBy: data.receivedBy
      } as Transfer;
    } catch (error) {
      console.error('Error getting transfer by ID:', error);
      throw error;
    }
  }
}
