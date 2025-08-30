require('dotenv').config({ path: './.env.local' });
const fetch = require('node-fetch');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
};

const app = initializeApp(config);
const auth = getAuth(app);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const FUNCTION_URL = process.env.CREATE_USER_FN_URL; // e.g. https://us-central1-<project>.cloudfunctions.net/api/createUserForAccount

if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !FUNCTION_URL) {
  console.error('Set ADMIN_EMAIL, ADMIN_PASSWORD and CREATE_USER_FN_URL in .env.local');
  process.exit(1);
}

(async () => {
  try {
    const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    const idToken = await cred.user.getIdToken();
    console.log('Admin signed in, uid=', cred.user.uid);

    const body = {
      accountId: process.env.ACCOUNT_ID || 'account-demo',
      email: process.env.NEW_USER_EMAIL || `new+${Date.now()}@example.com`,
  password: process.env.NEW_USER_PASSWORD || 'Test1234!',
  role: process.env.NEW_USER_ROLE || 'worker',
  name: process.env.NEW_USER_NAME || `Test User ${Date.now()}`,
  branchId: process.env.NEW_USER_BRANCHID || process.env.NEW_USER_BRANCH_ID || null,
    };

    const r = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    console.log('Function response', r.status, data);
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.error('Error calling function:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
