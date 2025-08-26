// Inicializa un documento accounts/{accountId} con limits y counts.
require('dotenv').config({ path: './.env.local' });
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

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

const argv = process.argv.slice(2);
const accountId = process.env.ACCOUNT_ID || argv[0] || 'account-demo';
const ownerUid = process.env.OWNER_UID || argv[1] || null;
const plan = process.env.PLAN || argv[2] || 'starter';

const PLANS = {
  basic: { admins: 1, workers: 1 },
  starter: { admins: 1, workers: 4 },
  premium: { admins: 2, workers: 5 },
};

const limits = PLANS[plan] || PLANS.starter;
const counts = { admins: ownerUid ? 1 : 0, workers: 0 };

(async () => {
  try {
    console.log(`Inicializando account ${accountId} plan=${plan}`);
    const ref = doc(db, 'accounts', accountId);
    await setDoc(ref, { ownerUid: ownerUid || null, limits, counts, createdAt: Date.now() }, { merge: true });
    console.log('Documento accounts creado/actualizado:', accountId);
    if (ownerUid) console.log('OwnerUid:', ownerUid);
    process.exit(0);
  } catch (e) {
    console.error('Error inicializando account:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
