const { initializeApp } = require('firebase/app');
const { getFirestore, collection, onSnapshot } = require('firebase/firestore');
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
  console.log('Subscribing to sales and printing those for branch-1');
  const unsub = onSnapshot(collection(db, 'sales'), (snap) => {
    const sales = snap.docs.map(d => ({ id: d.id, ...(d.data()) }));
    const filtered = sales.filter(s => s.branchId === 'branch-1');
    console.log('Total sales:', sales.length, 'Filtered branch-1:', filtered.length);
  });
  setTimeout(() => { unsub(); process.exit(0); }, 5000);
})();

