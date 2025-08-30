// Read-only diagnostic: list open cash_register_sessions and surface possible problems
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Try to load service account from env var or local file
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', 'ventifyServiceKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('Service account key not found at', keyPath);
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS or place ventifyServiceKey.json at the project root.');
  process.exit(2);
}

const key = require(keyPath);
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

(async () => {
  try {
    console.log('Querying open sessions in cash_register_sessions...');
    const snaps = await db.collection('cash_register_sessions').where('status', '==', 'open').get();
    if (snaps.empty) {
      console.log('No open sessions found.');
      process.exit(0);
    }
    console.log(`Found ${snaps.size} open session(s):\n`);
    snaps.forEach(doc => {
      const d = doc.data();
      const id = doc.id;
      const accountId = d.accountId === undefined ? '<missing>' : (d.accountId === null ? '<null>' : String(d.accountId));
      const hasOpenTime = d.openTime !== undefined && d.openTime !== null;
      let openTimeInfo = 'missing';
      if (hasOpenTime) {
        // detect Firestore Timestamp
        if (d.openTime && typeof d.openTime.toDate === 'function') {
          openTimeInfo = `Timestamp -> ${d.openTime.toDate().toISOString()}`;
        } else if (typeof d.openTime === 'number') {
          openTimeInfo = `number -> ${new Date(d.openTime).toISOString()}`;
        } else if (d.openTime._seconds) {
          openTimeInfo = `legacy-object -> seconds:${d.openTime._seconds}`;
        } else {
          openTimeInfo = `unknown-type (${typeof d.openTime})`;
        }
      }
      const idPattern = id.match(/^active_(?<acc>[^_]+)_(?<branch>.+)$/);
      const oldPattern = id.match(/^active_(?<branchOnly>.+)$/);
      console.log(`- id: ${id}`);
      if (idPattern) {
        console.log(`  -> parsed accountId in id: ${idPattern.groups.acc}, branch: ${idPattern.groups.branch}`);
      } else if (oldPattern) {
        console.log(`  -> legacy id format (no account): ${oldPattern.groups.branchOnly}`);
      } else {
        console.log('  -> id does not match active_* pattern');
      }
      console.log(`  accountId field: ${accountId}`);
      console.log(`  openTime: ${openTimeInfo}`);
      console.log(`  initialAmount: ${d.initialAmount}`);
      console.log(`  status: ${d.status}`);
      console.log('');
    });
    process.exit(0);
  } catch (err) {
    console.error('Failed to query sessions:', err);
    process.exit(1);
  }
})();
