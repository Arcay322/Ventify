import { db } from '@/lib/firebase';
import { Sale } from '@/types/sale';
import { collection, onSnapshot, addDoc, DocumentData, QueryDocumentSnapshot, QuerySnapshot, runTransaction, doc, DocumentReference, query, where, updateDoc, getDoc, increment } from 'firebase/firestore';
import { applyAdjustments } from './inventory-service';
import { Product } from '@/types/product';
import { activeSessionId, resolveAccountIdFromAuth } from './cash-register-service';

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

export const getSales = (callback: (sales: Sale[]) => void, accountId?: string) => {
  const salesCollection = collection(db, SALES_COLLECTION);
  const q = accountId ? query(salesCollection, where('accountId', '==', accountId)) : salesCollection;
  const unsubscribe = onSnapshot(q as any, (snapshot: QuerySnapshot<DocumentData>) => {
    const sales = snapshot.docs.map(saleFromDoc).sort((a: Sale, b: Sale) => (b.date || 0) - (a.date || 0));
    callback(sales);
  }, (err) => {
    console.error('onSnapshot error (sales query)', { errorCode: err && err.code, message: err && err.message });
  });
  return unsubscribe;
};

type Adjustment = { productId: string; branchId: string; delta: number };

export const saveSale = async (sale: Partial<Sale>) => {
  // Persist the sale and decrement stock per item in a transaction
  return runTransaction(db, async (tx) => {
    // Prepare sale ref and data (we'll write it after validating stock)
    const saleRef = doc(collection(db, SALES_COLLECTION));
    const saleData = { ...sale } as any;

    // Build adjustments: decrement quantity per product for the given branch
    const branchId = sale.branchId as string;
  const adjustments: Adjustment[] = (sale.items || []).map((it: any) => ({ productId: (it as Product).id, branchId, delta: -Math.abs((it as any).quantity) }));

    // Perform all reads first to validate stock levels
  const prodRefs: DocumentReference[] = adjustments.map(adj => doc(db, 'products', adj.productId));
  const snaps = await Promise.all(prodRefs.map(r => tx.get(r)));

  const updates: { ref: DocumentReference; data: Partial<Product> }[] = [];
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
  updates.push({ ref: prodRefs[i], data: { stock: newStock } });
    }

    // All reads are done; now perform writes (product stock updates, then sale)
    for (const u of updates) {
      tx.update(u.ref, u.data);
    }

    // If there is an active session for this branch/account, increment its counters atomically
    const branch = branchId;
    const account = (saleData as any).accountId as string | undefined;
    if (branch) {
      try {
        const resolvedAccount = await resolveAccountIdFromAuth(account);
        if (resolvedAccount) {
          const sessionId = activeSessionId(branch, resolvedAccount);
          const sessionRef = doc(db, 'cash_register_sessions', sessionId);
          const sessionSnap = await tx.get(sessionRef);
          if (sessionSnap.exists() && sessionSnap.data()?.status === 'open') {
          const incs: any = { totalSales: increment(saleData.total || 0) };
          // choose which payment counter
          const pm = saleData.paymentMethod;
          if (pm === 'Efectivo') incs.cashSales = increment(saleData.total || 0);
          else if (pm === 'Tarjeta') incs.cardSales = increment(saleData.total || 0);
          else if (pm === 'Digital') incs.digitalSales = increment(saleData.total || 0);
          // use transaction update with FieldValue increments
            tx.update(sessionRef, incs as any);
            }
          }
        } catch (e) {
        console.warn('Could not update cash register session in transaction', e);
      }
    }

  // Persist optional metadata if provided
  if ((saleData as any).accountId) saleData.accountId = (saleData as any).accountId;
  if ((saleData as any).sessionId) saleData.sessionId = (saleData as any).sessionId;

  tx.set(saleRef, saleData);
    return saleRef.id;
  });
};
