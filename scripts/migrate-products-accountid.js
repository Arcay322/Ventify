// Script para migrar productos existentes y agregarles accountId
// Ejecutar con: node scripts/migrate-products-accountid.js

const admin = require('firebase-admin');

// Inicializar Firebase Admin (asegúrate de tener las credenciales configuradas)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function migrateProductsAccountId() {
  try {
    console.log('🔄 Iniciando migración de productos...');
    
    // Obtener todos los productos
    const productsSnapshot = await db.collection('products').get();
    console.log(`📦 Encontrados ${productsSnapshot.size} productos`);
    
    if (productsSnapshot.empty) {
      console.log('❌ No se encontraron productos para migrar');
      return;
    }
    
    // Obtener todas las cuentas para asignar productos
    const accountsSnapshot = await db.collection('accounts').get();
    console.log(`🏢 Encontradas ${accountsSnapshot.size} cuentas`);
    
    if (accountsSnapshot.empty) {
      console.log('❌ No se encontraron cuentas. Crea una cuenta primero.');
      return;
    }
    
    // Usar la primera cuenta encontrada (o puedes especificar una)
    const firstAccount = accountsSnapshot.docs[0];
    const accountId = firstAccount.id;
    console.log(`🎯 Asignando productos a la cuenta: ${accountId}`);
    
    const batch = db.batch();
    let updatedCount = 0;
    
    productsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Solo actualizar si no tiene accountId
      if (!data.accountId) {
        console.log(`📝 Actualizando producto: ${data.name} (${doc.id})`);
        batch.update(doc.ref, { accountId });
        updatedCount++;
      } else {
        console.log(`✅ Producto ya tiene accountId: ${data.name} (${doc.id})`);
      }
    });
    
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ Migración completada. ${updatedCount} productos actualizados.`);
    } else {
      console.log('ℹ️ No hay productos que necesiten migración.');
    }
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  }
}

// Ejecutar la migración
migrateProductsAccountId()
  .then(() => {
    console.log('🎉 Script completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });