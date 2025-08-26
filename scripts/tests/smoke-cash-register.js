// Smoke test for cash register session flows
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, query, where, limit, getDocs, updateDoc, doc, getDoc, setDoc } = require('firebase/firestore');
require('dotenv').config({ path: './.env.local' });

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
};

const app = initializeApp(config);
const db = getFirestore(app);

(async () => {
  try {
    // Try to create a session
  const branchId = 'branch-1';
  console.log('Creating cash session for', branchId, 'with initial 100');
  // Create a deterministic session document so subsequent reads/updates target the same doc
  const sessionRef = doc(db, 'cash_register_sessions', `active_${branchId}`);
  await setDoc(sessionRef, { branchId, initialAmount: 100, openTime: Date.now(), status: 'open', totalSales:0, cashSales:0, cardSales:0, digitalSales:0 });
  console.log('Session created', sessionRef.id);

  // Add a sale by updating the open session (read once, then update)
  const snap = await getDoc(sessionRef);
  const current = (snap.exists() && snap.data()) ? snap.data() : {};
  const totalSales = (current.totalSales || 0) + 20;
  const cashSales = (current.cashSales || 0) + 20;
  await updateDoc(sessionRef, { totalSales, cashSales });
  console.log('Sale added to session');

  // Close session
  await updateDoc(sessionRef, { status: 'closed', closeTime: Date.now(), countedAmount: 120, expectedAmount: 100 + 20, difference: 0 });
    console.log('Session closed');
    process.exit(0);
  } catch (e) {
    console.error('Smoke cash register failed', e);
    process.exit(1);
  }
})();
