const admin = require('firebase-admin');
const path = require('path');

const keyPath = path.resolve(__dirname, '..', 'ventifyServiceKey.json');
try {
  admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
} catch (e) {
  // already initialized
}

const db = admin.firestore();

const uid = process.argv[2] || process.env.TARGET_UID || '04CpgG0rO1Ow3jEfOKpOcDBAOR92';

(async () => {
  try {
    console.log('Querying users/' + uid);
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log('No users/' + uid + ' document found.');
      process.exit(0);
    }
    console.log('users/' + uid + ' ->', JSON.stringify(snap.data(), null, 2));
  } catch (err) {
    console.error('Error reading users doc:', err);
    process.exit(2);
  }
})();
