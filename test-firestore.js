// test-firestore.js
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

(async () => {
  try {
    await db.doc('diagnostic/ping').set({ ts: Date.now() });
    console.log('Firestore write OK');
  } catch (e) {
    console.error('Firestore write FAILED', e);
    process.exit(1);
  }
})();