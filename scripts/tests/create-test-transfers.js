// Script para crear datos de prueba para transferencias
const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = require('../functions/tmp-admin-test/ventify-6c419-firebase-adminsdk-5pj5o-7d4ed2b23d.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'ventify-6c419'
    });
  } catch (error) {
    console.log('⚠️  Service account not found, using emulator mode...');
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    admin.initializeApp({
      projectId: 'ventify-6c419'
    });
  }
}

const db = admin.firestore();

async function createTestTransfers() {
  console.log('🚀 Creating test transfers...\n');

  try {
    // 1. Get account data
    const accountsSnapshot = await db.collection('accounts').limit(1).get();
    if (accountsSnapshot.empty) {
      throw new Error('No accounts found');
    }
    const accountId = accountsSnapshot.docs[0].id;
    console.log('✅ Using account:', accountId);

    // 2. Get branches
    const branchesSnapshot = await db.collection('branches')
      .where('accountId', '==', accountId)
      .limit(3)
      .get();
    
    if (branchesSnapshot.size < 2) {
      console.log('⚠️  Need at least 2 branches for transfers');
      return;
    }

    const branches = branchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('✅ Found branches:', branches.map(b => b.name).join(', '));

    // 3. Get products
    const productsSnapshot = await db.collection('products')
      .where('accountId', '==', accountId)
      .limit(5)
      .get();
    
    if (productsSnapshot.empty) {
      console.log('⚠️  No products found');
      return;
    }

    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('✅ Found products:', products.length);

    // 4. Create sample transfers
    const transfers = [
      {
        accountId,
        sourceBranchId: branches[0].id,
        destinationBranchId: branches[1].id,
        products: [{
          productId: products[0].id,
          quantity: 5,
          name: products[0].name,
          sku: products[0].sku || 'SKU-001',
          category: products[0].category || 'General'
        }],
        status: 'pending',
        notes: 'Transferencia de prueba - pendiente de aprobación',
        requestedBy: 'test-cashier-1',
        requestedAt: admin.firestore.Timestamp.now()
      },
      {
        accountId,
        sourceBranchId: branches[1].id,
        destinationBranchId: branches[0].id,
        products: [{
          productId: products[1].id,
          quantity: 10,
          name: products[1].name,
          sku: products[1].sku || 'SKU-002',
          category: products[1].category || 'General'
        }],
        status: 'approved',
        notes: 'Transferencia de prueba - aprobada por gerente',
        requestedBy: 'test-manager-1',
        requestedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24*60*60*1000)),
        approvedBy: 'test-manager-2',
        approvedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 23*60*60*1000))
      },
      {
        accountId,
        sourceBranchId: branches[0].id,
        destinationBranchId: branches.length > 2 ? branches[2].id : branches[1].id,
        products: [
          {
            productId: products[2].id,
            quantity: 3,
            name: products[2].name,
            sku: products[2].sku || 'SKU-003',
            category: products[2].category || 'General'
          },
          {
            productId: products[3].id,
            quantity: 7,
            name: products[3].name,
            sku: products[3].sku || 'SKU-004',
            category: products[3].category || 'General'
          }
        ],
        status: 'in_transit',
        notes: 'Transferencia múltiple en tránsito',
        requestedBy: 'test-cashier-2',
        requestedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 48*60*60*1000)),
        approvedBy: 'test-manager-3',
        approvedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 47*60*60*1000)),
        shippedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 46*60*60*1000))
      },
      {
        accountId,
        sourceBranchId: branches[1].id,
        destinationBranchId: branches[0].id,
        products: [{
          productId: products[4].id,
          quantity: 15,
          name: products[4].name,
          sku: products[4].sku || 'SKU-005',
          category: products[4].category || 'General'
        }],
        status: 'completed',
        notes: 'Transferencia completada exitosamente',
        requestedBy: 'test-manager-2',
        requestedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 72*60*60*1000)),
        approvedBy: 'test-manager-1',
        approvedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 71*60*60*1000)),
        shippedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 70*60*60*1000)),
        completedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 69*60*60*1000)),
        receivedBy: 'test-cashier-1'
      }
    ];

    // 5. Add transfers to database
    console.log('\n📦 Creating transfers...');
    for (const transfer of transfers) {
      const transferRef = await db.collection('transfers').add(transfer);
      console.log(`✅ Created transfer ${transferRef.id} (${transfer.status})`);
      console.log(`   ${transfer.products.length} product(s): ${transfer.products.map(p => p.name).join(', ')}`);
      console.log(`   ${branches.find(b => b.id === transfer.sourceBranchId)?.name} → ${branches.find(b => b.id === transfer.destinationBranchId)?.name}`);
    }

    console.log('\n🎉 Test transfers created successfully!');
    console.log('\n📋 Summary:');
    console.log('- 1 Pending transfer (needs approval)');
    console.log('- 1 Approved transfer (ready to ship)');
    console.log('- 1 In-transit transfer (needs completion)');
    console.log('- 1 Completed transfer');
    
    console.log('\n🔗 Visit http://localhost:9002/transfers to see the transfers');

  } catch (error) {
    console.error('❌ Error creating test transfers:', error);
  }
}

// Run the script
createTestTransfers().then(() => {
  console.log('\n✨ Script completed. Exiting...');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
