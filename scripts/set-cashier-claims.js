// Usage: node scripts/set-cashier-claims.js <uid> <serviceAccountKeyPath>
// Sets custom claims for a cashier user based on their Firestore document

const admin = require('firebase-admin');
const path = require('path');

async function main() {
  const uid = process.argv[2];
  const keyPath = process.argv[3] || './ventifyServiceKey.json';
  
  if (!uid) {
    console.error('Usage: node scripts/set-cashier-claims.js <uid> [serviceAccountKeyPath]');
    process.exit(1);
  }

  try {
    const key = require(path.resolve(keyPath));
    admin.initializeApp({ credential: admin.credential.cert(key) });
    const db = admin.firestore();

    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      console.error('User document not found in Firestore for uid:', uid);
      process.exit(1);
    }

    const userData = userDoc.data();

    // Set custom claims based on user document
    const claims = {
      accountId: userData.accountId,
      role: userData.role,
    };

    // Add branchId claim if user has one (for cashiers and managers)
    if (userData.branchId) {
      claims.branchId = userData.branchId;
    }

    // Add admin flag for owners and admins
    if (userData.role === 'owner' || userData.role === 'admin') {
      claims.admin = true;
    }

    await admin.auth().setCustomUserClaims(uid, claims);
    console.log('✅ Custom claims set successfully for uid:', uid);
    console.log('Claims:', claims);
    console.log('⚠️  User must sign out and sign back in for claims to take effect');

  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(2);
  }
}

main();
