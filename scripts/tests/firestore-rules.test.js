/**
 * Basic rules unit test: ensure firestore.rules prevents overwriting active_{branchId}
 * Requires: npm install (dev dependency @firebase/rules-unit-testing)
 */
const fs = require('fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

(async () => {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  const testEnv = await initializeTestEnvironment({
    projectId: 'ventify-test',
    firestore: {
      rules,
    },
  });

  const alice = testEnv.authenticatedContext('alice', { uid: 'alice' });
  const db = alice.firestore();

  const sessionId = 'active_branch-1';
  const ref = db.collection('cash_register_sessions').doc(sessionId);

  console.log('Attempting first create (should succeed)');
  await assertSucceeds(ref.set({ branchId: 'branch-1', status: 'open', initialAmount: 50, totalSales:0, cashSales:0 }));
  console.log('First create succeeded');

  console.log('Attempting second create (should fail)');
  try {
    await assertFails(ref.set({ branchId: 'branch-1', status: 'open', initialAmount: 10 }));
    console.log('Second create was correctly rejected by rules');
    process.exit(0);
  } catch (e) {
    console.error('Rules test failed', e);
    process.exit(1);
  } finally {
    await testEnv.cleanup();
  }
})();
