// Usar este script en la consola del navegador después de autenticarse
// Abrir la aplicación en el navegador y ejecutar en DevTools console

const defaultDiscountSettings = {
  cashierMaxDiscount: 20,
  cashierMaxDiscountType: 'amount',
  managerMaxDiscount: 50,
  managerMaxDiscountType: 'percentage',
  requireApprovalAbove: 100,
  allowNegativeInventory: false,
  trackDiscountReasons: true
};

// Función para crear la configuración en Firestore
async function initDiscountSettings() {
  try {
    // Obtener el accountId del usuario actual
    const user = auth.currentUser;
    if (!user) {
      console.error('Usuario no autenticado');
      return;
    }

    const token = await user.getIdTokenResult();
    const accountId = token.claims.accountId;
    
    if (!accountId) {
      console.error('AccountId no encontrado en los claims del usuario');
      return;
    }

    // Crear el documento en Firestore
    await db.collection('discount_settings').doc(accountId).set(defaultDiscountSettings);
    
    console.log('✅ Configuración de descuentos inicializada para account:', accountId);
  } catch (error) {
    console.error('❌ Error inicializando configuración de descuentos:', error);
  }
}

console.log('Ejecuta: initDiscountSettings()');
