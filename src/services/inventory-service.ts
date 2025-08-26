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
  const refs: DocumentReference[] = adjustments.map(a => doc(db, 'products', a.productId));
  const snaps = await Promise.all(refs.map(r => tx.get(r)));
  const updates: [DocumentReference, Partial<Product>][] = [];
    for (let i = 0; i < adjustments.length; i++) {
      const adj = adjustments[i];
      const snap = snaps[i];
      if (!snap.exists()) throw new Error('Product not found: ' + adj.productId);
  const data: any = snap.data();
  const stock: Record<string, number> = data.stock || {};
  const prev = typeof stock[adj.branchId] === 'number' ? stock[adj.branchId] : 0;
      const next = prev + adj.delta;
      if (next < 0) throw new Error('Insufficient stock for product ' + adj.productId + ' in branch ' + adj.branchId);
      const newStock = { ...stock, [adj.branchId]: next };
      updates.push([refs[i], { stock: newStock }]);
    }
    for (const [ref, data] of updates) {
      tx.update(ref, data);
    }
    return true;
  });
};
