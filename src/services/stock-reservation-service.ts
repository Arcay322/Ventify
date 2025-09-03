import { doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product } from '@/types/product';

export class StockReservationService {
    
    /**
     * Reservar stock para una lista de productos
     */
    static async reserveStock(
        items: Array<{ productId: string; quantity: number; branchId: string }>,
        accountId: string
    ): Promise<{ success: boolean; errors: string[] }> {
        const errors: string[] = [];
        
        try {
            await runTransaction(db, async (transaction) => {
                // Leer todos los productos primero
                const productRefs = items.map(item => doc(db, 'products', item.productId));
                const productDocs = await Promise.all(
                    productRefs.map(ref => transaction.get(ref))
                );

                // Verificar stock disponible y preparar actualizaciones
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const productDoc = productDocs[i];
                    
                    if (!productDoc.exists()) {
                        errors.push(`Producto ${item.productId} no encontrado`);
                        continue;
                    }

                    const product = productDoc.data() as Product;
                    const currentStock = product.stock[item.branchId] || 0;
                    const currentReserved = product.reservedStock?.[item.branchId] || 0;
                    const availableStock = currentStock - currentReserved;

                    if (availableStock < item.quantity) {
                        errors.push(`Stock insuficiente para ${product.name}. Disponible: ${availableStock}, Solicitado: ${item.quantity}`);
                        continue;
                    }

                    // Actualizar stock reservado
                    const newReservedStock = {
                        ...(product.reservedStock || {}),
                        [item.branchId]: currentReserved + item.quantity
                    };

                    transaction.update(productRefs[i], {
                        reservedStock: newReservedStock
                    });
                }

                // Si hay errores, abortar la transacción
                if (errors.length > 0) {
                    throw new Error(errors.join('; '));
                }
            });

            return { success: true, errors: [] };
            
        } catch (error) {
            console.error('Error reserving stock:', error);
            return { 
                success: false, 
                errors: error instanceof Error ? [error.message] : ['Error desconocido al reservar stock']
            };
        }
    }

    /**
     * Liberar stock reservado (cuando se cancela o vence una reserva)
     */
    static async releaseReservedStock(
        items: Array<{ productId: string; quantity: number; branchId: string }>,
        accountId: string
    ): Promise<{ success: boolean; errors: string[] }> {
        const errors: string[] = [];
        
        try {
            await runTransaction(db, async (transaction) => {
                // Leer todos los productos primero
                const productRefs = items.map(item => doc(db, 'products', item.productId));
                const productDocs = await Promise.all(
                    productRefs.map(ref => transaction.get(ref))
                );

                // Liberar stock reservado
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const productDoc = productDocs[i];
                    
                    if (!productDoc.exists()) {
                        errors.push(`Producto ${item.productId} no encontrado`);
                        continue;
                    }

                    const product = productDoc.data() as Product;
                    const currentReserved = product.reservedStock?.[item.branchId] || 0;
                    const newReservedAmount = Math.max(0, currentReserved - item.quantity);

                    // Actualizar stock reservado
                    const newReservedStock = {
                        ...(product.reservedStock || {}),
                        [item.branchId]: newReservedAmount
                    };

                    // Si el stock reservado es 0, podemos eliminar la entrada
                    if (newReservedAmount === 0) {
                        delete newReservedStock[item.branchId];
                    }

                    transaction.update(productRefs[i], {
                        reservedStock: Object.keys(newReservedStock).length > 0 ? newReservedStock : {}
                    });
                }
            });

            return { success: true, errors: [] };
            
        } catch (error) {
            console.error('Error releasing reserved stock:', error);
            return { 
                success: false, 
                errors: error instanceof Error ? [error.message] : ['Error desconocido al liberar stock']
            };
        }
    }

    /**
     * Completar reserva: mover stock reservado a venta real (reducir stock físico)
     */
    static async completeReservation(
        items: Array<{ productId: string; quantity: number; branchId: string }>,
        accountId: string
    ): Promise<{ success: boolean; errors: string[] }> {
        const errors: string[] = [];
        
        try {
            await runTransaction(db, async (transaction) => {
                // Leer todos los productos primero
                const productRefs = items.map(item => doc(db, 'products', item.productId));
                const productDocs = await Promise.all(
                    productRefs.map(ref => transaction.get(ref))
                );

                // Completar la reserva: reducir stock físico y reservado
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const productDoc = productDocs[i];
                    
                    if (!productDoc.exists()) {
                        errors.push(`Producto ${item.productId} no encontrado`);
                        continue;
                    }

                    const product = productDoc.data() as Product;
                    const currentStock = product.stock[item.branchId] || 0;
                    const currentReserved = product.reservedStock?.[item.branchId] || 0;

                    // Verificar que hay suficiente stock físico y reservado
                    if (currentStock < item.quantity) {
                        errors.push(`Stock físico insuficiente para ${product.name}. Disponible: ${currentStock}, Necesario: ${item.quantity}`);
                        continue;
                    }

                    // Actualizar stock físico (reducir)
                    const newStock = {
                        ...product.stock,
                        [item.branchId]: currentStock - item.quantity
                    };

                    // Actualizar stock reservado (liberar)
                    const newReservedAmount = Math.max(0, currentReserved - item.quantity);
                    const newReservedStock = {
                        ...(product.reservedStock || {}),
                        [item.branchId]: newReservedAmount
                    };

                    // Si el stock reservado es 0, eliminar la entrada
                    if (newReservedAmount === 0) {
                        delete newReservedStock[item.branchId];
                    }

                    transaction.update(productRefs[i], {
                        stock: newStock,
                        reservedStock: Object.keys(newReservedStock).length > 0 ? newReservedStock : {}
                    });
                }

                // Si hay errores, abortar la transacción
                if (errors.length > 0) {
                    throw new Error(errors.join('; '));
                }
            });

            return { success: true, errors: [] };
            
        } catch (error) {
            console.error('Error completing reservation:', error);
            return { 
                success: false, 
                errors: error instanceof Error ? [error.message] : ['Error desconocido al completar reserva']
            };
        }
    }

    /**
     * Calcular stock disponible para venta (stock físico - stock reservado)
     */
    static getAvailableStock(product: Product, branchId: string): number {
        const physicalStock = product.stock[branchId] || 0;
        const reservedStock = product.reservedStock?.[branchId] || 0;
        return Math.max(0, physicalStock - reservedStock);
    }

    /**
     * Verificar si hay suficiente stock disponible para una reserva
     */
    static canReserveStock(
        items: Array<{ productId: string; quantity: number; branchId: string }>, 
        products: Product[]
    ): { canReserve: boolean; errors: string[] } {
        const errors: string[] = [];

        for (const item of items) {
            const product = products.find(p => p.id === item.productId);
            if (!product) {
                errors.push(`Producto ${item.productId} no encontrado`);
                continue;
            }

            const availableStock = this.getAvailableStock(product, item.branchId);
            if (availableStock < item.quantity) {
                errors.push(`${product.name}: Disponible ${availableStock}, solicitado ${item.quantity}`);
            }
        }

        return {
            canReserve: errors.length === 0,
            errors
        };
    }
}
