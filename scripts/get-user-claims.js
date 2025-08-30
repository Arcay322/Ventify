// Usage: node scripts/get-user-claims.js <uid> <serviceAccountJsonPath>
// Example: node .\scripts\get-user-claims.js L5O8aXNKxzcZRATtHdBx4ZYNVwx2 .\ventifyServiceKey.json

const admin = require('firebase-admin');
const path = require('path');

async function main() {
  const uid = process.argv[2];
  const keyPath = process.argv[3] || './ventifyServiceKey.json';
  if (!uid) {
    console.error('Usage: node scripts/get-user-claims.js <uid> [serviceAccountJsonPath]');
    process.exit(1);
  }
  try {
    const key = require(path.resolve(keyPath));
    admin.initializeApp({ credential: admin.credential.cert(key) });
    const user = await admin.auth().getUser(uid);
    console.log('UID:', uid);
    console.log('customClaims:', user.customClaims || {});
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(2);
  }
}

main();
