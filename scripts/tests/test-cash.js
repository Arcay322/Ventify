const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, query, where, limit, getDocs, updateDoc, doc, serverTimestamp, onSnapshot, increment } = require('firebase/firestore');
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

const CASH_REGISTER_COLLECTION = 'cash_register_sessions';

async function createCashRegisterSession(branchId, initialAmount) {
  const id = `active_${branchId}`;
  const ref = doc(db, CASH_REGISTER_COLLECTION, id);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().status === 'open') return false;
  await setDoc(ref, { id, branchId, initialAmount, openTime: serverTimestamp(), status: 'open', totalSales: 0, cashSales: 0, cardSales: 0, digitalSales: 0 });
  return true;
}

async function addSaleToActiveSession(branchId, sale) {
  const ref = doc(db, CASH_REGISTER_COLLECTION, `active_${branchId}`);
  const updateData = { totalSales: increment(sale.total) };
  if (sale.paymentMethod === 'Efectivo') updateData.cashSales = increment(sale.total);
  if (sale.paymentMethod === 'Tarjeta') updateData.cardSales = increment(sale.total);
  if (sale.paymentMethod === 'Digital') updateData.digitalSales = increment(sale.total);
  await updateDoc(ref, updateData);
}

async function getActiveSessionOnce(branchId) {
  const id = `active_${branchId}`;
  const d = await getDoc(doc(db, CASH_REGISTER_COLLECTION, id));
  if (!d.exists()) return null;
  return { id: d.id, ...(d.data()) };
}

async function closeSession(sessionId, countedAmount) {
  const ref = doc(db, CASH_REGISTER_COLLECTION, sessionId);
  await updateDoc(ref, { status: 'closed', closeTime: serverTimestamp(), countedAmount, expectedAmount: countedAmount, difference: 0 });
}

(async () => {
  console.log('Creating session...');
  const ok = await createCashRegisterSession('branch-1', 50);
  console.log('create ->', ok);
  console.log('Sleeping 1s'); await new Promise(r => setTimeout(r, 1000));
  try { await addSaleToActiveSession('branch-1', { total: 20, paymentMethod: 'Efectivo' }); console.log('sale added'); } catch (e) { console.error('add sale err', e.message); }
  await new Promise(r => setTimeout(r, 1000));
  const s = await getActiveSessionOnce('branch-1');
  if (!s) { console.error('no active session found'); process.exit(1); }
  try { await closeSession(s.id, (s.initialAmount||0) + (s.cashSales||0)); console.log('closed OK'); } catch (e) { console.error('close err', e.message); }
  process.exit(0);
})();

