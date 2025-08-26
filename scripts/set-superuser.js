/**
 * Script: set-superuser.js
 * Uso: export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccount.json" && node scripts/set-superuser.js user@example.com
 * Alternativamente, establece env SERVICE_ACCOUNT and the script will load it.
 * El script:
 *  - inicializa firebase-admin con la credencial proporcionada
 *  - busca el usuario por email
 *  - asigna custom claims { admin: true, superuser: true }
 *  - actualiza el documento firestore `users/{uid}` con role: 'owner' (merge)
 */

require('dotenv').config({ path: './.env.local' });
let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error('Missing dependency "firebase-admin". Run: npm install firebase-admin --save');
  process.exit(2);
}
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error('Usage: node scripts/set-superuser.js EMAIL [role]');
    process.exit(1);
  }
  const email = args[0];
  const roleArg = args[1] || 'owner';

  // Initialize admin SDK
  if (!admin.apps.length) {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.SERVICE_ACCOUNT_PATH;
    if (credPath && fs.existsSync(credPath)) {
      admin.initializeApp({ credential: admin.credential.cert(require(credPath)) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Let admin SDK pick up ADC
      admin.initializeApp();
    } else {
      console.error('Service account not found. Set GOOGLE_APPLICATION_CREDENTIALS or SERVICE_ACCOUNT_PATH to a JSON file.');
      process.exit(2);
    }
  }

  try {
    const auth = admin.auth();
    const user = await auth.getUserByEmail(email);
    console.log('Found user:', user.uid, user.email);

    // Set custom claims
    const claims = { admin: true, superuser: true };
    await auth.setCustomUserClaims(user.uid, claims);
    console.log('Custom claims set:', claims);

    // Update Firestore user doc
    const db = admin.firestore();
    const userRef = db.doc(`users/${user.uid}`);
    await userRef.set({ role: roleArg }, { merge: true });
    console.log(`Updated users/${user.uid} role=${roleArg}`);

    console.log('Done. The custom claims may take a minute to propagate. To use them in the client, the user should sign out and sign in again to refresh the ID token.');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

main();
