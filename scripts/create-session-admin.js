require('dotenv').config({ path: './.env.local' });
const fs = require('fs');
let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error('Missing dependency "firebase-admin". Run: npm install firebase-admin --save');
  process.exit(2);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: node scripts/create-session-admin.js <uid> <accountId> <branchId> [initialAmount]');
    process.exit(1);
  }
  const [uid, accountId, branchId] = args;
  const initialAmount = Number(args[3] || 0);

  // Initialize admin SDK
  if (!admin.apps.length) {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.SERVICE_ACCOUNT_PATH;
    if (credPath && fs.existsSync(credPath)) {
      admin.initializeApp({ credential: admin.credential.cert(require(credPath)) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
    } else {
      console.error('Service account not found. Set GOOGLE_APPLICATION_CREDENTIALS or SERVICE_ACCOUNT_PATH to a JSON file.');
      process.exit(2);
    }
  }

  const db = admin.firestore();
  const activeId = `active_${accountId}_${branchId}`;
  const docRef = db.doc(`cash_register_sessions/${activeId}`);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const session = {
    id: activeId,
    branchId,
    accountId,
    startedBy: uid,
    initialAmount,
    openTime: now,
    status: 'open',
    totalSales: 0,
    cashSales: 0,
    cardSales: 0,
    digitalSales: 0,
  };

  try {
    await docRef.set(session, { merge: false });
    console.log('Created session:', activeId);
    process.exit(0);
  } catch (e) {
    console.error('Failed to create session', e);
    process.exit(1);
  }
}

main();
