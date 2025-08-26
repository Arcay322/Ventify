import { db } from '@/lib/firebase';
import { Sale } from '@/types/sale';
import { collection, onSnapshot, addDoc, DocumentData, QueryDocumentSnapshot, runTransaction, doc } from 'firebase/firestore';
import { applyAdjustments } from './inventory-service';

const SALES_COLLECTION = 'sales';

const saleFromDoc = (doc: QueryDocumentSnapshot<DocumentData>): Sale => {
  const data = doc.data();
  return {
    id: doc.id,
    date: data.date,
    items: data.items || [],
    total: data.total,
    subtotal: data.subtotal,
    tax: data.tax,
    discount: data.discount,
    paymentMethod: data.paymentMethod,
    branchId: data.branchId,
  } as Sale;
};

export const getSales = (callback: (sales: Sale[]) => void) => {
  const salesCollection = collection(db, SALES_COLLECTION);
  const unsubscribe = onSnapshot(salesCollection, (snapshot) => {
    const sales = snapshot.docs.map(saleFromDoc).sort((a, b) => (b.date || 0) - (a.date || 0));
    callback(sales);
  });
  return unsubscribe;
};

export const saveSale = async (sale: Partial<Sale>) => {
  // Persist the sale and decrement stock per item in a transaction
  return runTransaction(db, async (tx) => {
    // Create sale doc
    const saleRef = doc(collection(db, SALES_COLLECTION));
    const saleData = { ...sale } as any;
    tx.set(saleRef, saleData);

    // Build adjustments: decrement quantity per product for the given branch
    const branchId = sale.branchId as string;
    const adjustments = (sale.items || []).map((it: any) => ({ productId: it.id, branchId, delta: -Math.abs(it.quantity) }));

    // Apply adjustments using the same transaction context by reading/updating product docs
    for (const adj of adjustments) {
      const prodRef = doc(db, 'products', adj.productId);
      const prodSnap = await tx.get(prodRef);
      if (!prodSnap.exists()) throw new Error('Product not found: ' + adj.productId);
      const data: any = prodSnap.data();
      const stock = data.stock || {};
      const prev = typeof stock[adj.branchId] === 'number' ? stock[adj.branchId] : 0;
      const next = prev + adj.delta;
      if (next < 0) throw new Error('Insufficient stock for product ' + adj.productId + ' in branch ' + adj.branchId);
      const newStock = { ...stock, [adj.branchId]: next };
      tx.update(prodRef, { stock: newStock });
    }

    return saleRef.id;
  });
};
