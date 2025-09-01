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
import { BranchService } from './branch-service';

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
      const transfers = snapshot.docs.map(doc => {
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

      // Enrich transfers with branch names and user information
      return await this.enrichTransfersWithDetails(transfers, accountId);
    } catch (error) {
      console.error('Error getting transfers:', error);
      throw error;
    }
  }

  static async enrichTransfersWithDetails(transfers: Transfer[], accountId: string): Promise<any[]> {
    if (transfers.length === 0) return [];

    try {
      // Get all branches for this account
      const branches = await BranchService.getBranchesAsync(accountId);
      const branchMap = new Map(branches.map(b => [b.id, b.name]));

      // Get user names (we'll need to implement a user service for this)
      const userMap = new Map();
      
      // For now, we'll create a simple user lookup
      const userIds = new Set([
        ...transfers.map(t => t.requestedBy),
        ...transfers.map(t => t.approvedBy).filter(Boolean),
        ...transfers.map(t => t.receivedBy).filter(Boolean)
      ]);

      // Get user documents
      for (const userId of userIds) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            userMap.set(userId, userData.displayName || userData.email || 'Usuario desconocido');
          }
        } catch (error) {
          console.warn('Error getting user:', userId, error);
          userMap.set(userId, 'Usuario desconocido');
        }
      }

      // Enrich transfers with additional information
      return transfers.map(transfer => ({
        ...transfer,
        // Branch names
        fromBranchName: branchMap.get(transfer.sourceBranchId) || 'Sucursal desconocida',
        toBranchName: branchMap.get(transfer.destinationBranchId) || 'Sucursal desconocida',
        
        // User names
        requestedByName: userMap.get(transfer.requestedBy) || 'Usuario desconocido',
        approvedByName: transfer.approvedBy ? userMap.get(transfer.approvedBy) || 'Usuario desconocido' : undefined,
        receivedByName: transfer.receivedBy ? userMap.get(transfer.receivedBy) || 'Usuario desconocido' : undefined,
        
        // Convert Timestamp to Date for easier handling
        requestDate: transfer.requestedAt instanceof Timestamp ? transfer.requestedAt.toDate() : new Date(),
        
        // Additional computed fields for UI
        productName: transfer.products.length > 0 ? transfer.products[0].name : 'Sin productos',
        productSku: transfer.products.length > 0 ? transfer.products[0].sku : '',
        quantity: transfer.products.reduce((sum, p) => sum + p.quantity, 0)
      }));
    } catch (error) {
      console.error('Error enriching transfers:', error);
      // Return transfers without enrichment if there's an error
      return transfers.map(transfer => ({
        ...transfer,
        fromBranchName: 'Cargando...',
        toBranchName: 'Cargando...',
        requestedByName: 'Cargando...',
        requestDate: transfer.requestedAt instanceof Timestamp ? transfer.requestedAt.toDate() : new Date(),
        productName: transfer.products.length > 0 ? transfer.products[0].name : 'Sin productos',
        productSku: transfer.products.length > 0 ? transfer.products[0].sku : '',
        quantity: transfer.products.reduce((sum, p) => sum + p.quantity, 0)
      }));
    }
  }

  static async updateTransferStatus(
    transferId: string,
    newStatus: Transfer['status'],
    userId: string,
    additionalData?: any
  ): Promise<void> {
    try {
      console.log('TransferService.updateTransferStatus called:', { transferId, newStatus, userId, additionalData });
      
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

      console.log('Updating transfer with data:', updateData);
      await updateDoc(transferRef, updateData);
      console.log('Transfer updated successfully');
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
