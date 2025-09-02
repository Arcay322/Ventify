require('dotenv').config({ path: '../.env.local' });
const admin = require('firebase-admin');

// Configuración Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

try {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
  });
} catch (error) {
  console.log('Error inicializando Firebase:', error.message);
  process.exit(1);
}

const db = admin.firestore();

async function addAccountIdToProducts() {
  try {
    console.log('🔄 Iniciando migración de productos...');
    
    // Obtener todos los productos
    const allProductsSnapshot = await db.collection('products').get();
    
    if (allProductsSnapshot.empty) {
      console.log('📝 No se encontraron productos');
      return;
    }
    
    console.log(`� Encontrados ${allProductsSnapshot.size} productos total`);
    
    // Verificar cuáles no tienen accountId
    const productsWithoutAccountId = [];
    const productsWithAccountId = [];
    
    allProductsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!data.accountId) {
        productsWithoutAccountId.push({ doc, data });
      } else {
        productsWithAccountId.push({ doc, data });
      }
    });
    
    console.log(`� Productos sin accountId: ${productsWithoutAccountId.length}`);
    console.log(`✅ Productos con accountId: ${productsWithAccountId.length}`);
    
    if (productsWithoutAccountId.length === 0) {
      console.log('✅ Todos los productos ya tienen accountId asignado');
      return;
    }
    
    // Usar el accountId por defecto
    const defaultAccountId = 'acct_001';
    const batch = db.batch();
    
    productsWithoutAccountId.forEach(({ doc, data }) => {
      console.log(`📝 Migrando producto: ${data.name || 'Sin nombre'} (ID: ${doc.id})`);
      batch.update(doc.ref, { accountId: defaultAccountId });
    });
    
    await batch.commit();
    console.log(`✅ Migración completada: ${productsWithoutAccountId.length} productos actualizados con accountId: ${defaultAccountId}`);

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar la migración
addAccountIdToProducts()
  .then(() => {
    console.log('🎉 Migración completada exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  });
