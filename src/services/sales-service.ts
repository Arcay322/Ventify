import { db } from '@/lib/firebase';
import { Sale } from '@/types/sale';
import { collection, onSnapshot, addDoc, DocumentData, QueryDocumentSnapshot, QuerySnapshot, runTransaction, doc, DocumentReference, query, where, updateDoc, getDoc, increment, setDoc } from 'firebase/firestore';
import { applyAdjustments } from './inventory-service';
import { Product } from '@/types/product';
import { activeSessionId, resolveAccountIdFromAuth, addSaleToActiveSession } from './cash-register-service';

const SALES_COLLECTION = 'sales';

const saleFromDoc = (doc: QueryDocumentSnapshot<DocumentData>): Sale => {
  const data = doc.data();
  return {
    id: doc.id,
    saleNumber: data.saleNumber,
    date: data.date,
    items: data.items || [],
    total: data.total,
    subtotal: data.subtotal,
    tax: data.tax,
    discount: data.discount,
    paymentMethod: data.paymentMethod,
    branchId: data.branchId,
    // Campos de cliente
    customerId: data.customerId,
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    customerPhone: data.customerPhone,
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

// Función para generar un número de venta simple basado en timestamp
const generateSaleNumber = (): number => {
  // Generar número basado en timestamp (últimos 6 dígitos del timestamp)
  const timestamp = Date.now();
  const saleNumber = parseInt(timestamp.toString().slice(-6));
  return saleNumber;
};

export const saveSale = async (sale: Partial<Sale>) => {
  // First, update stock in a transaction (only stock updates)
  await runTransaction(db, async (tx) => {
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

    // Update stock
    for (const u of updates) {
      tx.update(u.ref, u.data);
    }
  });

  // Generate sale number and create the sale document
  const saleData = { ...sale } as any;
  
  // Persist optional metadata if provided
  if ((saleData as any).accountId) saleData.accountId = (saleData as any).accountId;
  if ((saleData as any).sessionId) saleData.sessionId = (saleData as any).sessionId;

  // Generate sale number based on timestamp
  try {
    saleData.saleNumber = generateSaleNumber();
  } catch (e) {
    console.warn('Could not generate sale number, proceeding without it', e);
  }

  const saleDocRef = await addDoc(collection(db, SALES_COLLECTION), saleData);
  const saleId = saleDocRef.id;

  // Update customer statistics separately if needed
  if (sale.customerId && sale.total) {
    try {
      const customerRef = doc(db, 'customers', sale.customerId);
      const customerSnap = await getDoc(customerRef);
      
      if (customerSnap.exists()) {
        const customerData = customerSnap.data();
        const newTotalPurchases = (customerData.totalPurchases || 0) + 1;
        const newTotalSpent = (customerData.totalSpent || 0) + sale.total;
        
        await updateDoc(customerRef, {
          totalPurchases: newTotalPurchases,
          totalSpent: newTotalSpent
        });
      }
    } catch (e) {
      console.warn('Could not update customer statistics', e);
    }
  }

  // Update session counters separately (best effort, outside transaction)
  const branch = sale.branchId;
  const account = (sale as any).accountId as string | undefined;
  
  if (branch) {
    try {
      await addSaleToActiveSession(branch, account, { 
        total: sale.total || 0, 
        paymentMethod: sale.paymentMethod || 'Efectivo',
        itemCount: (sale.items || []).length,
        customerName: sale.customerName,
        saleNumber: saleData.saleNumber
      });
    } catch (e) {
      console.warn('Could not update cash register session after sale', e);
    }
  }

  // Return the sale ID and sale number
  return { saleId, saleNumber: saleData.saleNumber };
};
