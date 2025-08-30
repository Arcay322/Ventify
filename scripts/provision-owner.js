
/*
Provision script for a single-owner tenant.
Usage (PowerShell):
  # Option A: use Application Default Credentials (set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON)
  $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\sa-key.json"
  node .\scripts\provision-owner.js <UID> <ACCOUNT_ID> "Business Name" "owner@example.com"

  # Option B: pass a service account file path as the optional 5th argument
  node .\scripts\provision-owner.js <UID> <ACCOUNT_ID> "Business Name" "owner@example.com" C:\path\to\sa-key.json

What it does:
 - Ensures users/{uid} exists with role='owner' and accountId
 - Ensures accounts/{accountId} exists with ownerUid and sensible limits/counts
 - Sets a custom user claim { admin: true } for the uid

Notes:
 - This script must be run by a developer/admin with access to a service account that has Firestore and Auth privileges.
 - It will merge fields (won't clobber unrelated data).
*/

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 3) {
    console.error('Usage: node provision-owner.js <uid> <accountId> "Business Name" [email] [serviceAccountPath]');
    process.exit(1);
  }
  const [uid, accountId, businessNameRaw, emailArg, saPathArg] = argv;
  const businessName = businessNameRaw || 'My Business';
  const email = emailArg || '';
  const saPath = saPathArg || process.env.GOOGLE_APPLICATION_CREDENTIALS || null;

  try {
    if (saPath) {
      const resolvedSaPath = path.resolve(saPath);
      if (!fs.existsSync(resolvedSaPath)) {
        console.error('Service account file not found at', resolvedSaPath);
        process.exit(1);
      }
      const serviceAccount = require(resolvedSaPath);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      // Try ADC
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    }
  } catch (e) {
    console.error('Failed to initialize Firebase Admin SDK. Provide a service account JSON or set GOOGLE_APPLICATION_CREDENTIALS.', e && e.message);
    process.exit(1);
  }

  const db = admin.firestore();

  try {
    console.log('Provisioning user doc users/' + uid + ' and account ' + accountId);
    // Ensure an Auth user exists for the requested UID (or fall back to existing user for the email)
    let effectiveUid = uid;
    try {
      await admin.auth().getUser(uid);
      console.log('Auth user exists:', uid);
    } catch (err) {
      if (err && err.code === 'auth/user-not-found') {
        // Try to create the user with the provided uid
        try {
          const createPayload = { uid };
          if (email) createPayload.email = email;
          if (businessName) createPayload.displayName = businessName;
          const newUser = await admin.auth().createUser(createPayload);
          effectiveUid = newUser.uid;
          console.log('Created Auth user', effectiveUid);
        } catch (createErr) {
          // If the email is already in use, fall back to that existing user
          if (createErr && createErr.code === 'auth/email-already-exists' && email) {
            try {
              const existing = await admin.auth().getUserByEmail(email);
              console.warn('Email already in use by uid', existing.uid, '; using that uid for claims and user doc.');
              effectiveUid = existing.uid;
            } catch (getByEmailErr) {
              console.warn('Failed to lookup existing user by email after create failure:', getByEmailErr && getByEmailErr.message);
            }
          } else {
            console.warn('Failed to create Auth user for', uid, createErr && createErr.message);
          }
        }
      } else {
        console.warn('Failed to fetch Auth user', uid, err && err.message);
      }
    }

    if (effectiveUid !== uid) {
      console.log('Note: effective UID used for provisioning is', effectiveUid);
    }

    // Write users/{effectiveUid}
    const userPayload = {
      email: email || null,
      role: 'owner',
      accountId: accountId,
      displayName: businessName,
      createdAt: Date.now(),
    };
    await db.doc(`users/${effectiveUid}`).set(userPayload, { merge: true });
    console.log('Wrote users/' + effectiveUid);

    // Write accounts/{accountId}
    const accountPayload = {
      name: businessName,
      ownerUid: effectiveUid,
      createdAt: Date.now(),
      limits: { admins: 1, workers: 4 },
      counts: { admins: 1, workers: 0 },
    };
    await db.doc(`accounts/${accountId}`).set(accountPayload, { merge: true });
    console.log('Wrote accounts/' + accountId);

    // Set custom claim admin:true on the effective UID
    try {
      await admin.auth().setCustomUserClaims(effectiveUid, { admin: true });
      console.log('Set custom claim {admin:true} for', effectiveUid);
    } catch (e) {
      console.warn('Failed to set custom claim for', effectiveUid, e && e.message);
    }

    // If we have an email, generate and print a password reset link
    if (email) {
      try {
        const resetLink = await admin.auth().generatePasswordResetLink(email);
        console.log('Password reset link:', resetLink);
      } catch (e) {
        console.warn('Failed to generate password reset link for', email, e && e.message);
      }
    }

    console.log('Provisioning complete.');
    process.exit(0);
  } catch (e) {
    console.error('Provisioning failed:', e && e.message);
    process.exit(2);
  }
}

main();
