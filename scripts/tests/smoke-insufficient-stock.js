// Smoke test: attempt sale with insufficient stock -> expect failure
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
require('dotenv').config({ path: './.env.local' });

const config = { projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID };
const app = initializeApp(config);
const db = getFirestore(app);

(async () => {
  try {
    const branchId = 'branch-1';
    console.log('Creating product with stock 1 at', branchId);
    const p = { name: 'LowStock', category: 'Test', price: 1, costPrice: 0.5, stock: { [branchId]: 1 }, sku: 'LOW-001', imageUrl: '', hint: '' };
    const prodRef = await addDoc(collection(db, 'products'), p);
    const pid = prodRef.id;
    console.log('Product id', pid);

    const { runTransaction, doc: docRef } = require('firebase/firestore');
    try {
      await runTransaction(db, async (tx) => {
        const prod = await tx.get(docRef(db, 'products', pid));
        const data = prod.data();
        const current = (data.stock && data.stock[branchId]) || 0;
        if (current < 3) throw new Error('insufficient stock');
      });
      console.error('Expected transaction to fail due to insufficient stock but it succeeded');
      process.exit(1);
    } catch (e) {
      console.log('Transaction failed as expected:', e.message);
      process.exit(0);
    }
  } catch (e) {
    console.error('Test setup failed', e);
    process.exit(1);
  }
})();
