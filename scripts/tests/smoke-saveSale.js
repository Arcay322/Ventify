// Smoke test for saveSale flow using Firestore SDK
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, getDoc, updateDoc } = require('firebase/firestore');
require('dotenv').config({ path: './.env.local' });

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
};

const app = initializeApp(config);
const db = getFirestore(app);

(async () => {
  try {
    const branchId = 'branch-1';
    console.log('Creating product with stock 5 at', branchId);
    const p = { name: 'SmokeProd', category: 'Test', price: 10, costPrice: 5, stock: { [branchId]: 5 }, sku: 'SMOKE-001', imageUrl: '', hint: '' };
    const prodRef = await addDoc(collection(db, 'products'), p);
    const pid = prodRef.id;
    console.log('Product id', pid);

    console.log('Attempting to create sale transaction (3 units)...');
    // Simple transactional approach: emulate saveSale logic: read then update in transaction
    const { runTransaction, doc: docRef } = require('firebase/firestore');
    const txRes = await runTransaction(db, async (tx) => {
      const prod = await tx.get(docRef(db, 'products', pid));
      if (!prod.exists()) throw new Error('Product not found');
      const data = prod.data();
      const current = (data.stock && data.stock[branchId]) || 0;
      if (current < 3) throw new Error('insufficient stock');
      const newStock = { ...(data.stock || {}), [branchId]: current - 3 };
      tx.update(docRef(db, 'products', pid), { stock: newStock });
  const { doc: _doc, collection: _collection } = require('firebase/firestore');
  const saleRef = _doc(_collection(db, 'sales'));
  tx.set(saleRef, { date: Date.now(), items: [{ id: pid, quantity: 3, price: p.price }], total: 30, subtotal: 30, tax:0, discount:0, paymentMethod:'Efectivo', branchId });
      return true;
    });
    console.log('Transaction result', txRes);
    process.exit(0);
  } catch (e) {
    console.error('Smoke saveSale failed', e);
    process.exit(1);
  }
})();
