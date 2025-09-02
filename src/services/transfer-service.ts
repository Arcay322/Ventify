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
import { applyAdjustments } from './inventory-service';

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
      
      // Get current transfer data to access products when completing
      const transferDoc = await getDoc(transferRef);
      if (!transferDoc.exists()) {
        throw new Error('Transfer not found');
      }
      
      const transferData = transferDoc.data() as Transfer;
      
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
          
          // Update stock when completing transfer
          console.log('🔄 Starting stock update for completed transfer');
          console.log('Transfer data:', transferData);
          console.log('Products in transfer:', transferData.products);
          
          if (!transferData.products || transferData.products.length === 0) {
            console.warn('⚠️  No products found in transfer - skipping stock update');
            break;
          }
          
          // Pre-validate stock availability before making any changes
          console.log('📋 Pre-validating stock availability...');
          
          for (const product of transferData.products) {
            console.log(`🔍 Checking stock for ${product.name} (${product.productId})`);
            
            // Get current product data
            const productRef = doc(db, 'products', product.productId);
            const productDoc = await getDoc(productRef);
            
            if (!productDoc.exists()) {
              throw new Error(`Product ${product.name} not found in database`);
            }
            
            const productData = productDoc.data();
            const currentStock = productData.stock?.[transferData.sourceBranchId] || 0;
            
            console.log(`   Current stock in source branch: ${currentStock}`);
            console.log(`   Required for transfer: ${product.quantity}`);
            
            if (currentStock < product.quantity) {
              throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${currentStock}, Requerido: ${product.quantity}`);
            }
          }
          
          console.log('✅ Stock validation passed, proceeding with adjustments');
          
          const adjustments = transferData.products.map(product => {
            console.log(`📦 Processing product: ${product.name} (${product.productId})`);
            console.log(`   From branch: ${transferData.sourceBranchId}`);
            console.log(`   To branch: ${transferData.destinationBranchId}`);
            console.log(`   Quantity: ${product.quantity}`);
            
            return [
              // Remove stock from source branch (negative delta)
              {
                productId: product.productId,
                branchId: transferData.sourceBranchId,
                delta: -product.quantity
              },
              // Add stock to destination branch (positive delta)
              {
                productId: product.productId,
                branchId: transferData.destinationBranchId,
                delta: product.quantity
              }
            ];
          }).flat();
          
          console.log('🔧 Final adjustments to apply:', adjustments);
          
          try {
            // Apply stock adjustments before updating transfer status
            await applyAdjustments(adjustments);
            console.log('✅ Stock adjustments applied successfully');
          } catch (stockError) {
            console.error('❌ Error applying stock adjustments:', stockError);
            throw new Error(`Error actualizando stock: ${stockError.message}`);
          }
          
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
