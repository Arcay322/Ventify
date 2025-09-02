import { db } from '@/lib/firebase';
import { doc, runTransaction, DocumentReference } from 'firebase/firestore';
import { Product } from '@/types/product';

/**
 * Adjust stock for a product in a branch by delta (positive to add, negative to remove)
 * Ensures the adjustment happens inside a transaction and returns the new stock value.
 */
export const adjustStock = async (productId: string, branchId: string, delta: number) => {
  const productRef = doc(db, 'products', productId);
  return runTransaction(db, async (tx) => {
  const prodSnap = await tx.get(productRef);
  if (!prodSnap.exists()) throw new Error('Product not found: ' + productId);
  const data: any = prodSnap.data();
  const stock: Record<string, number> = data.stock || {};
  const prev = typeof stock[branchId] === 'number' ? stock[branchId] : 0;
    const next = prev + delta;
    if (next < 0) throw new Error('Insufficient stock for product ' + productId + ' in branch ' + branchId);
    const newStock = { ...stock, [branchId]: next };
    tx.update(productRef, { stock: newStock });
    return next;
  });
};

/**
 * Convenience that applies multiple adjustments in a single transaction.
 * adjustments: Array<{ productId, branchId, delta }>
 */
export const applyAdjustments = async (adjustments: { productId: string; branchId: string; delta: number }[]) => {
  return runTransaction(db, async (tx) => {
    console.log('🔧 Starting inventory adjustments transaction');
    console.log('Adjustments to process:', adjustments);
    
    // Group adjustments by product to handle multiple branch updates per product
    const productGroups: Record<string, { productId: string; branchId: string; delta: number }[]> = {};
    adjustments.forEach(adj => {
      if (!productGroups[adj.productId]) {
        productGroups[adj.productId] = [];
      }
      productGroups[adj.productId].push(adj);
    });
    
    console.log('Grouped adjustments by product:', productGroups);
    
    const updates: [DocumentReference, Partial<Product>][] = [];
    
    for (const productId in productGroups) {
      const productAdjustments = productGroups[productId];
      const productRef = doc(db, 'products', productId);
      const productSnap = await tx.get(productRef);
      
      console.log(`📦 Processing product: ${productId}`);
      
      if (!productSnap.exists()) {
        const error = `Product not found: ${productId}`;
        console.error(`❌ ${error}`);
        throw new Error(error);
      }
      
      const data: any = productSnap.data();
      const currentStock: Record<string, number> = { ...(data.stock || {}) };
      
      console.log(`   Current stock for product:`, currentStock);
      
      // Apply all adjustments for this product
      const newStock = { ...currentStock };
      
      for (const adj of productAdjustments) {
        console.log(`   Processing adjustment for branch: ${adj.branchId}`);
        console.log(`   Delta: ${adj.delta}`);
        
        const prevStock = typeof newStock[adj.branchId] === 'number' ? newStock[adj.branchId] : 0;
        const nextStock = prevStock + adj.delta;
        
        console.log(`   Previous stock in branch: ${prevStock}`);
        console.log(`   New stock will be: ${nextStock}`);
        
        // Only check for insufficient stock on negative deltas (stock reductions)
        if (adj.delta < 0 && nextStock < 0) {
          const error = `Insufficient stock for product ${productId} in branch ${adj.branchId}. Current: ${prevStock}, Requested: ${Math.abs(adj.delta)}, Available: ${prevStock}`;
          console.error(`❌ ${error}`);
          throw new Error(error);
        }
        
        newStock[adj.branchId] = Math.max(0, nextStock);
      }
      
      console.log(`   Final stock for product ${productId}:`, newStock);
      updates.push([productRef, { stock: newStock }]);
    }
    
    console.log(`✅ All validations passed, applying ${updates.length} product updates`);
    
    for (const [ref, updateData] of updates) {
      tx.update(ref, updateData);
    }
    
    console.log('🎉 All inventory adjustments applied successfully');
    return true;
  });
};
