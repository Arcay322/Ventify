require('dotenv').config({ path: '.env.local' });

// Allow requiring TypeScript files (for mock-data.ts)
try {
  require('ts-node').register({ transpileOnly: true });
} catch (e) {
  // ts-node not available; the script may still work if mock-data.js exists
}

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
const path = require('path');

const mock = require(path.join(__dirname, '..', 'src', 'lib', 'mock-data.cjs'));

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  console.log('Seeding Firestore with mock data...');

  for (const b of mock.mockBranches) {
    try {
      await setDoc(doc(db, 'branches', b.id), b);
      console.log('Branch seeded:', b.id);
    } catch (err) {
      console.error('Error seeding branch', b.id, err);
    }
  }

  for (const p of mock.mockProducts) {
    try {
      await setDoc(doc(db, 'products', p.id), p);
      console.log('Product seeded:', p.id);
    } catch (err) {
      console.error('Error seeding product', p.id, err);
    }
  }

  for (const c of mock.mockCustomers) {
    try {
      await setDoc(doc(db, 'customers', c.id), c);
      console.log('Customer seeded:', c.id);
    } catch (err) {
      console.error('Error seeding customer', c.id, err);
    }
  }

  console.log('Seeding complete.');
}

seed().catch(err => { console.error('Seeding failed', err); process.exit(1); });
