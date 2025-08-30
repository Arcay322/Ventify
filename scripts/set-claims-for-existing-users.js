// Usage: node scripts/set-claims-for-existing-users.js <serviceAccountKeyPath>
// Requires: npm install firebase-admin

const admin = require('firebase-admin');
const fs = require('fs');

async function main() {
  const keyPath = process.argv[2];
  if (!keyPath) {
    console.error('Provide path to service account JSON as first arg');
    process.exit(1);
  }

  const serviceAccount = require(require('path').resolve(keyPath));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  console.log('Scanning users collection for accountId...');
  const usersSnap = await db.collection('users').get();
  console.log('Found', usersSnap.size, 'user docs');

  let updated = 0;
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (!data || !data.accountId) continue;
    try {
      const uid = doc.id;
      const userRecord = await admin.auth().getUser(uid).catch(() => null);
      if (!userRecord) {
        console.warn('No auth user for uid', uid); continue;
      }
      const existing = userRecord.customClaims || {};
      if (existing.accountId === data.accountId && existing.admin === (data.role === 'owner' || data.role === 'admin')) {
        continue; // already set
      }
      const claims = Object.assign({}, existing, { accountId: data.accountId });
      if (data.role === 'owner' || data.role === 'admin') claims.admin = true;
      await admin.auth().setCustomUserClaims(uid, claims);
      console.log('Set claims for', uid, claims);
      updated++;
    } catch (e) {
      console.error('Failed to set claims for', doc.id, e.message || e);
    }
  }

  console.log('Done. Updated', updated, 'users. Instruct users to sign out/in to refresh tokens.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
