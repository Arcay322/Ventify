// Smoke test for applyAdjustments using Firestore SDK
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
require('dotenv').config({ path: './.env.local' });

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
};

const app = initializeApp(config);
const db = getFirestore(app);

(async () => {
  try {
    const branchId = 'branch-1';
    console.log('Creating product with stock 2 at', branchId);
    const p = { name: 'AdjProd', category: 'Test', price: 5, costPrice: 2, stock: { [branchId]: 2 }, sku: 'ADJ-001', imageUrl: '', hint: '' };
    const prodRef = await addDoc(collection(db, 'products'), p);
    const pid = prodRef.id;
    console.log('Product id', pid);

    const { runTransaction, doc: docRef } = require('firebase/firestore');
    const ok = await runTransaction(db, async (tx) => {
      const prod = await tx.get(docRef(db, 'products', pid));
      if (!prod.exists()) throw new Error('Product not found');
      const data = prod.data();
      const current = (data.stock && data.stock[branchId]) || 0;
      const next = current - 1;
      if (next < 0) throw new Error('insufficient stock');
      tx.update(docRef(db, 'products', pid), { stock: { ...(data.stock||{}), [branchId]: next } });
      return true;
    });

    console.log('Adjustment applied', ok);
    process.exit(0);
  } catch (e) {
    console.error('Smoke applyAdjustments failed', e);
    process.exit(1);
  }
})();
