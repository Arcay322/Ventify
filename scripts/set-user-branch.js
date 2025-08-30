#!/usr/bin/env node
/**
 * Simple helper to set branchId (and optional name) on users/{uid} documents using the Admin SDK.
 * Usage:
 *   node scripts/set-user-branch.js --uid=<UID> --branch=<BRANCH_ID> [--name="Full Name"]
 *   node scripts/set-user-branch.js --uids=uid1,uid2 --branch=<BRANCH_ID>
 * You can run this locally if you have GOOGLE_APPLICATION_CREDENTIALS env var set to a service account JSON
 * with access to the project's Firestore, or run it from a machine with gcloud auth application-default login.
 */

require('dotenv').config({ path: './.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');

// Initialize admin SDK. If SERVICE_ACCOUNT_KEY_PATH env is provided, use it; otherwise rely on ADC.
if (process.env.SERVICE_ACCOUNT_KEY_PATH && fs.existsSync(process.env.SERVICE_ACCOUNT_KEY_PATH)) {
  const key = require(process.env.SERVICE_ACCOUNT_KEY_PATH);
  admin.initializeApp({ credential: admin.credential.cert(key) });
} else {
  admin.initializeApp();
}

const db = admin.firestore();

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const p = process.argv[i];
    if (!p.startsWith('--')) continue;
    const [k, v] = p.slice(2).split('=');
    args[k] = v === undefined ? true : v;
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const uid = args.uid;
  const uids = (args.uids && args.uids.split(',')) || (uid ? [uid] : null);
  const branch = args.branch || args.branchId || args.branch_id;
  const name = args.name;
  const file = args.file; // optional JSON file [{uid,branchId,name},...]

  if (!uids && !file) {
    console.error('Provide --uid or --uids or --file');
    process.exit(1);
  }

  let items = [];
  if (file) {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) items = parsed;
    } catch (e) {
      console.error('Failed reading file', e && e.message);
      process.exit(1);
    }
  }

  if (uids) {
    uids.forEach(u => items.push({ uid: u, branchId: branch, name }));
  }

  for (const it of items) {
    const uid = it.uid;
    const branchId = it.branchId;
    const payload = {};
    if (branchId) payload.branchId = branchId;
    if (it.name) payload.name = it.name;
    if (Object.keys(payload).length === 0) {
      console.warn('Nothing to update for', uid);
      continue;
    }
    try {
      await db.doc(`users/${uid}`).set(payload, { merge: true });
      console.log(`Updated users/${uid} ->`, payload);
    } catch (e) {
      console.error(`Failed updating users/${uid}:`, e && e.message);
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
