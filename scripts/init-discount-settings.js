const admin = require('firebase-admin');
const path = require('path');

// Usar el mismo patrón que los otros scripts
const keyPath = './ventifyServiceKey.json';
const key = require(path.resolve(keyPath));

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(key)
});

const db = admin.firestore();

const defaultDiscountSettings = {
  cashierMaxDiscount: 20,
  cashierMaxDiscountType: 'amount',
  managerMaxDiscount: 50,
  managerMaxDiscountType: 'percentage',
  requireApprovalAbove: 100,
  allowNegativeInventory: false,
  trackDiscountReasons: true
};

async function initDiscountSettings() {
  try {
    const accountId = 'test_account'; // Reemplazar con tu account ID real
    
    await db.collection('discount_settings').doc(accountId).set(defaultDiscountSettings);
    
    console.log('✅ Configuración de descuentos inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando configuración de descuentos:', error);
  } finally {
    process.exit();
  }
}

initDiscountSettings();
