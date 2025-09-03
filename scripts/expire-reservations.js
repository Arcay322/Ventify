const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID
    });
}

const db = admin.firestore();

async function expireReservations() {
    try {
        console.log('🔍 Buscando reservas vencidas...');
        
        const now = Date.now();
        
        // Buscar reservas pendientes que ya vencieron
        const expiredReservationsQuery = db.collection('reservations')
            .where('status', '==', 'pending')
            .where('expiryDate', '<', now);
        
        const snapshot = await expiredReservationsQuery.get();
        
        if (snapshot.empty) {
            console.log('✅ No hay reservas vencidas');
            return;
        }
        
        console.log(`📋 Encontradas ${snapshot.size} reservas vencidas`);
        
        // Procesar cada reserva vencida
        const batch = db.batch();
        const stockUpdates = new Map(); // productId -> { branchId -> quantityToRelease }
        
        snapshot.docs.forEach(doc => {
            const reservation = doc.data();
            console.log(`⏰ Venciendo reserva #${reservation.reservationNumber} de ${reservation.customerName}`);
            
            // Marcar reserva como vencida
            batch.update(doc.ref, {
                status: 'expired',
                expiredDate: now
            });
            
            // Preparar actualizaciones de stock
            reservation.items.forEach(item => {
                const key = `${item.id}_${reservation.branchId}`;
                if (!stockUpdates.has(key)) {
                    stockUpdates.set(key, {
                        productId: item.id,
                        branchId: reservation.branchId,
                        quantity: 0
                    });
                }
                stockUpdates.get(key).quantity += item.quantity;
            });
        });
        
        // Actualizar stock reservado de productos
        console.log('📦 Liberando stock reservado...');
        
        for (const update of stockUpdates.values()) {
            const productRef = db.collection('products').doc(update.productId);
            const productDoc = await productRef.get();
            
            if (!productDoc.exists) {
                console.warn(`⚠️  Producto ${update.productId} no encontrado`);
                continue;
            }
            
            const product = productDoc.data();
            const currentReserved = product.reservedStock?.[update.branchId] || 0;
            const newReservedAmount = Math.max(0, currentReserved - update.quantity);
            
            const newReservedStock = { ...(product.reservedStock || {}) };
            
            if (newReservedAmount === 0) {
                delete newReservedStock[update.branchId];
            } else {
                newReservedStock[update.branchId] = newReservedAmount;
            }
            
            batch.update(productRef, {
                reservedStock: Object.keys(newReservedStock).length > 0 ? newReservedStock : {}
            });
            
            console.log(`📦 Producto ${product.name}: Liberados ${update.quantity} unidades en ${update.branchId}`);
        }
        
        // Ejecutar todas las actualizaciones
        await batch.commit();
        
        console.log(`✅ Procesadas ${snapshot.size} reservas vencidas y liberado su stock`);
        
    } catch (error) {
        console.error('❌ Error procesando reservas vencidas:', error);
        throw error;
    }
}

async function main() {
    console.log('🚀 Iniciando proceso de vencimiento de reservas...');
    
    try {
        await expireReservations();
        console.log('✅ Proceso completado exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en el proceso:', error);
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main();
}

module.exports = { expireReservations };
