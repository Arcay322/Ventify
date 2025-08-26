/*
  Script: recalc-account-counts.js
  Purpose: Recalculate accounts/{accountId}.counts from existing users documents and optionally apply the fix.

  Usage (dry-run):
    node scripts/recalc-account-counts.js --project=<PROJECT_ID>

  Apply changes:
    node scripts/recalc-account-counts.js --project=<PROJECT_ID> --apply

  Limit to one account:
    node scripts/recalc-account-counts.js --project=<PROJECT_ID> --accountId=account-demo --apply

  Notes:
  - This script uses the Firebase Admin SDK. Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON
    with Firestore and Auth permissions, or run in an environment where Application Default Credentials are available.
  - Safe by default: without --apply it only prints proposed changes.
*/

const admin = require('firebase-admin');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('project', { type: 'string', description: 'Firebase project id', demandOption: false })
  .option('accountId', { type: 'string', description: 'Only fix this account' })
  .option('apply', { type: 'boolean', description: 'Apply changes (otherwise dry-run)', default: false })
  .help()
  .argv;

(async function main() {
  try {
    // initialize admin
    if (!admin.apps.length) {
      admin.initializeApp({
        // If GOOGLE_APPLICATION_CREDENTIALS is set, the Admin SDK will use it.
        // Optionally provide projectId from argv.project
        projectId: argv.project || undefined,
      });
    }
    const db = admin.firestore();

    // Build account list
    let accountIds = [];
    if (argv.accountId) {
      accountIds = [argv.accountId];
    } else {
      // Read all accounts docs
      const snap = await db.collection('accounts').get();
      accountIds = snap.docs.map(d => d.id);
    }

    console.log('Accounts to evaluate:', accountIds);

    for (const accountId of accountIds) {
      console.log('\n---- account:', accountId);
      // Query users belonging to this account
      const usersSnap = await db.collection('users').where('accountId', '==', accountId).get();
      const counts = { admins: 0, workers: 0 };
      usersSnap.forEach(doc => {
        const data = doc.data() || {};
        const role = (data.role || '').toString().toLowerCase();
        if (role === 'owner' || role === 'admin') counts.admins += 1;
        else counts.workers += 1;
      });

      const acctRef = db.collection('accounts').doc(accountId);
      const acctSnap = await acctRef.get();
      const acctData = acctSnap.exists ? acctSnap.data() : null;

      console.log('Calculated counts from users collection:', counts);
      console.log('Existing account counts:', acctData && acctData.counts ? acctData.counts : '(none)');

      if (!acctSnap.exists) {
        console.log('Account doc does not exist. Creating with calculated counts and default limits.');
        if (argv.apply) {
          await acctRef.set({ counts, limits: { admins: Math.max(1, counts.admins), workers: Math.max(1, counts.workers) } }, { merge: true });
          console.log('Created account doc with counts.');
        }
        continue;
      }

      const existing = (acctData && acctData.counts) ? acctData.counts : { admins: 0, workers: 0 };

      if (existing.admins === counts.admins && existing.workers === counts.workers) {
        console.log('No change required for account:', accountId);
        continue;
      }

      console.log('Proposed update -> counts:', counts);
      if (argv.apply) {
        await acctRef.update({ counts });
        console.log('Applied counts update for', accountId);
      } else {
        console.log('Dry-run mode. Use --apply to persist changes.');
      }
    }

    console.log('\nDone.');
    process.exit(0);
  } catch (e) {
    console.error('Error', e);
    process.exit(1);
  }
})();
