const admin = require('firebase-admin');

const admin = require('firebase-admin');

// Initialize Firebase Admin with emulator settings
if (!admin.apps.length) {
  // Use the Firebase emulator for testing if no credentials available
  try {
    // Try to initialize with service account (production)
    const serviceAccount = require('../../functions/tmp-admin-test/ventify-6c419-firebase-adminsdk-5pj5o-7d4ed2b23d.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'ventify-6c419'
    });
  } catch (error) {
    // Fall back to emulator mode
    console.log('⚠️  Service account not found, using Firebase emulator...');
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    admin.initializeApp({
      projectId: 'ventify-6c419'
    });
  }
}

const db = admin.firestore();

async function testTransferSystem() {
  console.log('🚀 Testing Transfer System...\n');

  try {
    // 1. Get test account data
    const accountsSnapshot = await db.collection('accounts').limit(1).get();
    if (accountsSnapshot.empty) {
      throw new Error('No accounts found for testing');
    }
    const accountId = accountsSnapshot.docs[0].id;
    console.log('✅ Using account:', accountId);

    // 2. Get branches for this account
    const branchesSnapshot = await db.collection('branches')
      .where('accountId', '==', accountId)
      .limit(2)
      .get();
    
    if (branchesSnapshot.size < 2) {
      console.log('⚠️  Need at least 2 branches for transfer testing');
      return;
    }

    const branches = branchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const sourceBranch = branches[0];
    const destinationBranch = branches[1];
    
    console.log('✅ Source branch:', sourceBranch.name, `(${sourceBranch.id})`);
    console.log('✅ Destination branch:', destinationBranch.name, `(${destinationBranch.id})`);

    // 3. Get a test product
    const productsSnapshot = await db.collection('products')
      .where('accountId', '==', accountId)
      .limit(1)
      .get();
    
    if (productsSnapshot.empty) {
      console.log('⚠️  No products found for transfer testing');
      return;
    }

    const product = {
      id: productsSnapshot.docs[0].id,
      ...productsSnapshot.docs[0].data()
    };
    
    console.log('✅ Using product:', product.name, `(${product.id})`);
    console.log('📦 Current stock:', JSON.stringify(product.stock, null, 2));

    // 4. Create a test transfer
    const transferData = {
      accountId,
      sourceBranchId: sourceBranch.id,
      destinationBranchId: destinationBranch.id,
      products: [{
        productId: product.id,
        quantity: 5,
        name: product.name,
        sku: product.sku || '',
        category: product.category || ''
      }],
      status: 'pending',
      requestedBy: 'test-user-id',
      requestedAt: admin.firestore.Timestamp.now(),
      notes: 'Test transfer created by automated script'
    };

    const transferRef = await db.collection('transfers').add(transferData);
    console.log('✅ Created transfer with ID:', transferRef.id);

    // 5. Test transfer status updates
    console.log('\n📋 Testing transfer workflow...');

    // Approve transfer
    await transferRef.update({
      status: 'approved',
      approvedBy: 'test-manager-id',
      approvedAt: admin.firestore.Timestamp.now()
    });
    console.log('✅ Transfer approved');

    // Mark as in transit
    await transferRef.update({
      status: 'in_transit',
      shippedAt: admin.firestore.Timestamp.now()
    });
    console.log('✅ Transfer marked as in transit');

    // Complete transfer (this would normally update stock)
    await transferRef.update({
      status: 'completed',
      completedAt: admin.firestore.Timestamp.now(),
      receivedBy: 'test-receiver-id'
    });
    console.log('✅ Transfer completed');

    // 6. Verify final transfer state
    const finalTransfer = await transferRef.get();
    const finalData = finalTransfer.data();
    
    console.log('\n📊 Final transfer data:');
    console.log({
      id: transferRef.id,
      status: finalData.status,
      products: finalData.products,
      timeline: {
        requested: finalData.requestedAt?.toDate(),
        approved: finalData.approvedAt?.toDate(),
        shipped: finalData.shippedAt?.toDate(),
        completed: finalData.completedAt?.toDate()
      }
    });

    // 7. Test transfer queries
    console.log('\n🔍 Testing transfer queries...');
    
    const pendingTransfers = await db.collection('transfers')
      .where('accountId', '==', accountId)
      .where('status', '==', 'pending')
      .get();
    console.log('✅ Pending transfers found:', pendingTransfers.size);

    const completedTransfers = await db.collection('transfers')
      .where('accountId', '==', accountId)
      .where('status', '==', 'completed')
      .get();
    console.log('✅ Completed transfers found:', completedTransfers.size);

    // 8. Cleanup - delete the test transfer
    await transferRef.delete();
    console.log('✅ Test transfer deleted');

    console.log('\n🎉 Transfer system test completed successfully!');

  } catch (error) {
    console.error('❌ Transfer system test failed:', error.message);
    console.error(error);
  }
}

// Run the test
testTransferSystem().then(() => {
  console.log('\n✨ Test completed. Exiting...');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
