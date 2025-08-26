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

const id = Math.floor(Math.random()*100000).toString();
(async () => {
  // Use branch-1 for tests
  const branchId = 'branch-1';
  console.log('Creating product with stock 5 at', branchId);
  const p = { name: 'TestProd-'+id, category: 'Test', price: 10, stock: { [branchId]: 5 }, sku: 'T'+id };
  const prodRef = await addDoc(collection(db, 'products'), p);
  const pid = prodRef.id;
  console.log('Product id', pid);

  console.log('Attempting sale of 3 units...');
  // naive stock decrement (not transaction-safe): read, write
  const prodSnap = await getDoc(doc(db, 'products', pid));
  const data = prodSnap.data();
  const current = (data.stock && data.stock[branchId]) || 0;
  if (current < 3) { console.error('insufficient stock'); process.exit(1); }
  const newStock = { ...(data.stock || {}), [branchId]: current - 3 };
  await updateDoc(doc(db, 'products', pid), { stock: newStock });
  // create sale doc
  await addDoc(collection(db, 'sales'), { date: Date.now(), items: [{ id: pid, name: p.name, sku: p.sku, quantity: 3, price: p.price }], total: 30, branchId, paymentMethod: 'Efectivo' });
  console.log('Sale created');
  process.exit(0);
})();
