const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, updateDoc } = require('firebase/firestore');

// Firebase config - replace with your actual config
const firebaseConfig = {
  apiKey: "AIzaSyD8HEqOyTXk4TT45MHZJ1T8L7nDOhBJcrs",
  authDomain: "ventify-xead3.firebaseapp.com",
  projectId: "ventify-xead3",
  storageBucket: "ventify-xead3.firebasestorage.app",
  messagingSenderId: "888848909632",
  appId: "1:888848909632:web:e3c1e26ab8b0e3f1063d32"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugTransferStock() {
  try {
    console.log('🔍 Debugging transfer stock issues...\n');

    // 1. Get all transfers
    const transfersSnapshot = await getDocs(collection(db, 'transfers'));
    const transfers = [];
    
    transfersSnapshot.forEach(doc => {
      transfers.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`📋 Found ${transfers.length} transfers:\n`);
    
    transfers.forEach(transfer => {
      console.log(`Transfer ID: ${transfer.id}`);
      console.log(`Status: ${transfer.status}`);
      console.log(`From: ${transfer.sourceBranchId} → To: ${transfer.destinationBranchId}`);
      console.log(`Products: ${transfer.products?.length || 0}`);
      if (transfer.products && transfer.products.length > 0) {
        transfer.products.forEach(p => {
          console.log(`  - ${p.name} (${p.productId}): ${p.quantity} units`);
        });
      }
      console.log(`Completed: ${transfer.completedAt ? 'Yes' : 'No'}\n`);
    });

    // 2. Check current stock for "Silla" product
    const productsSnapshot = await getDocs(collection(db, 'products'));
    let sillaProduct = null;
    
    productsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.name === 'Silla') {
        sillaProduct = { id: doc.id, ...data };
      }
    });

    if (sillaProduct) {
      console.log(`📦 Current stock for "Silla" (${sillaProduct.id}):`);
      console.log(JSON.stringify(sillaProduct.stock, null, 2));
      console.log('');
    }

    // 3. Calculate what the stock should be based on completed transfers
    const completedTransfers = transfers.filter(t => t.status === 'completed');
    const stockChanges = {};

    completedTransfers.forEach(transfer => {
      if (transfer.products) {
        transfer.products.forEach(product => {
          if (!stockChanges[product.productId]) {
            stockChanges[product.productId] = {};
          }
          
          // Source branch loses stock
          if (!stockChanges[product.productId][transfer.sourceBranchId]) {
            stockChanges[product.productId][transfer.sourceBranchId] = 0;
          }
          stockChanges[product.productId][transfer.sourceBranchId] -= product.quantity;
          
          // Destination branch gains stock
          if (!stockChanges[product.productId][transfer.destinationBranchId]) {
            stockChanges[product.productId][transfer.destinationBranchId] = 0;
          }
          stockChanges[product.productId][transfer.destinationBranchId] += product.quantity;
        });
      }
    });

    console.log('📊 Stock changes from completed transfers:');
    console.log(JSON.stringify(stockChanges, null, 2));

  } catch (error) {
    console.error('Error debugging transfers:', error);
  }
}

// Run the debug function
debugTransferStock();
