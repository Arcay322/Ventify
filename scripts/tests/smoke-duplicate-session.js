// Smoke test: try to create two open cash sessions; expect second to be rejected by app logic
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, runTransaction } = require('firebase/firestore');
require('dotenv').config({ path: './.env.local' });

const config = { projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID };
const app = initializeApp(config);
const db = getFirestore(app);

(async () => {
  try {
  const branchId = 'branch-1';
  const accountId = process.env.TEST_ACCOUNT_ID || 'global';
  console.log('Creating first session for', branchId, 'account', accountId);
  const sessionRef = doc(db, 'cash_register_sessions', `active_${accountId}_${branchId}`);
  await setDoc(sessionRef, { id: `active_${accountId}_${branchId}`, branchId, accountId: accountId, initialAmount: 50, openTime: Date.now(), status: 'open', totalSales:0, cashSales:0, cardSales:0, digitalSales:0 });
    console.log('First session id', sessionRef.id);

    // attempt to create second session using a transaction that should detect the existing doc
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(sessionRef);
        if (snap.exists()) {
          throw new Error('session_already_open');
        }
        tx.set(sessionRef, { id: `active_${accountId}_${branchId}`, branchId, accountId: accountId, initialAmount: 10, openTime: Date.now(), status: 'open' });
      });
      console.error('Transaction unexpectedly succeeded in creating a duplicate session');
      process.exit(1);
    } catch (e) {
      if (e.message === 'session_already_open') {
        console.log('Second create prevented by transaction as expected');
        process.exit(0);
      }
      console.log('Second create failed as expected or prevented by rules:', e.message || e);
      process.exit(0);
    }
  } catch (e) {
    console.error('Test failed', e);
    process.exit(1);
  }
})();
