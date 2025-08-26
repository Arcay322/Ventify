// Smoke test for users and settings CRUD
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, setDoc, getDoc, deleteDoc } = require('firebase/firestore');
require('dotenv').config({ path: './.env.local' });

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
};

const app = initializeApp(config);
const db = getFirestore(app);

(async () => {
  try {
    console.log('Creating user...');
    const user = { name: 'Smoke User', email: 'smoke@ventify.test', role: 'Cajero', branchId: 'branch-1' };
    const uref = await addDoc(collection(db, 'users'), user);
    console.log('User created', uref.id);

    console.log('Updating settings...');
    const sref = doc(db, 'settings', 'global');
    await setDoc(sref, { businessName: 'Ventify Test', ruc: '20123456789', address: 'Test St', taxRate: 18 }, { merge: true });
    const snap = await getDoc(sref);
    console.log('Settings now:', snap.data());

    console.log('Cleaning up test user');
    await deleteDoc(uref);
    process.exit(0);
  } catch (e) {
    console.error('Smoke users/settings failed', e);
    process.exit(1);
  }
})();
