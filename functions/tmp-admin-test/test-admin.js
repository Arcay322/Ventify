const admin = require("firebase-admin");
(async () => {
  try {
    const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG).projectId || 'ventify-xead3';
    console.log('Using projectId:', projectId);
    admin.initializeApp({ projectId });
    const db = admin.firestore();
    const ref = db.doc('accounts/debug_test_node');
    await ref.set({ test: true, ts: Date.now() });
    const snap = await ref.get();
    console.log('Wrote doc, exists:', snap.exists, 'data:', snap.data());
  } catch (e) {
    console.error('Admin SDK write error:', e);
    if (e && e.code) console.error('code:', e.code);
  }
})();
