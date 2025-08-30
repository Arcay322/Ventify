#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/close-active-session.js --branch=<BRANCH_ID> [--account=<ACCOUNT_ID>] [--delete]
 *
 * This script uses the Firebase Admin SDK. Provide credentials via
 * GOOGLE_APPLICATION_CREDENTIALS or run on an environment with admin access.
 */
const admin = require('firebase-admin');
const argv = require('minimist')(process.argv.slice(2));

if (!argv.branch) {
  console.error('Missing --branch argument');
  process.exit(2);
}

if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (e) {
    console.error('Failed to initialize firebase-admin. Ensure GOOGLE_APPLICATION_CREDENTIALS is set or run in a Google environment.');
    console.error(e);
    process.exit(3);
  }
}

const db = admin.firestore();
const branchId = String(argv.branch);
const accountId = argv.account ? String(argv.account) : undefined;
const doDelete = !!argv.delete;

async function run() {
  // If accountId provided, try deterministic id first
  if (accountId) {
    const id = `active_${accountId}_${branchId}`;
    const ref = db.collection('cash_register_sessions').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log('No active session found for id', id);
    } else {
      console.log('Found session', id, snap.data());
      if (doDelete) {
        await ref.delete();
        console.log('Deleted session', id);
      } else {
        await ref.update({ status: 'closed', closeTime: admin.firestore.FieldValue.serverTimestamp() });
        console.log('Closed session', id);
      }
      return;
    }
  }

  // Fallback: query open sessions for branch
  const q = db.collection('cash_register_sessions').where('branchId', '==', branchId).where('status', '==', 'open');
  const snaps = await q.get();
  if (snaps.empty) {
    console.log('No open sessions found for branch', branchId);
    return;
  }
  for (const doc of snaps.docs) {
    console.log('Found open session', doc.id, doc.data());
    if (doDelete) {
      await doc.ref.delete();
      console.log('Deleted', doc.id);
    } else {
      await doc.ref.update({ status: 'closed', closeTime: admin.firestore.FieldValue.serverTimestamp() });
      console.log('Closed', doc.id);
    }
  }
}

run().catch(err => { console.error('Error running script', err); process.exit(1); });
