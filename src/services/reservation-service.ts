import { collection, addDoc, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Reservation, ReservationStatus } from '@/types/reservation';
import { StockReservationService } from './stock-reservation-service';
import { ReservationDepositService } from './reservation-deposit-service';

export class ReservationService {
    private static readonly COLLECTION_NAME = 'reservations';

    // Crear una nueva reserva
    static async createReservation(reservation: Omit<Reservation, 'id' | 'reservationNumber'>): Promise<Reservation> {
        try {
            // Verificar y reservar stock antes de crear la reserva
            const stockItems = reservation.items.map(item => ({
                productId: item.id,
                quantity: item.quantity,
                branchId: reservation.branchId
            }));

            const stockResult = await StockReservationService.reserveStock(
                stockItems, 
                reservation.accountId as string
            );

            if (!stockResult.success) {
                throw new Error(`Stock insuficiente: ${stockResult.errors.join('; ')}`);
            }

            // Generar número de reserva secuencial
            const reservationNumber = await this.generateReservationNumber(reservation.branchId, reservation.accountId as string);
            
            const reservationData = {
                ...reservation,
                reservationNumber,
                date: Date.now(),
                status: 'pending' as ReservationStatus,
                // Si no se especifica expiración, usar 7 días por defecto
                expiryDate: reservation.expiryDate || (Date.now() + (7 * 24 * 60 * 60 * 1000))
            };

            // Limpiar campos undefined antes de guardar
            const cleanReservationData = Object.fromEntries(
                Object.entries(reservationData).filter(([_, value]) => value !== undefined)
            );

            const docRef = await addDoc(collection(db, this.COLLECTION_NAME), cleanReservationData);
            
            // Devolver la reserva completa con el ID generado
            const completeReservation: Reservation = {
                ...cleanReservationData,
                id: docRef.id
            } as Reservation;
            
            return completeReservation;
        } catch (error) {
            console.error('Error creating reservation:', error);
            throw new Error('No se pudo crear la reserva');
        }
    }

    // Generar número de reserva secuencial
    private static async generateReservationNumber(branchId: string, accountId: string): Promise<number> {
        try {
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            const endOfDay = startOfDay + (24 * 60 * 60 * 1000) - 1;

            const q = query(
                collection(db, this.COLLECTION_NAME),
                where('accountId', '==', accountId),
                where('branchId', '==', branchId),
                where('date', '>=', startOfDay),
                where('date', '<=', endOfDay),
                orderBy('date', 'desc')
            );

            const snapshot = await getDocs(q);
            
            // Buscar el número más alto manualmente
            let maxNumber = 0;
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.reservationNumber && data.reservationNumber > maxNumber) {
                    maxNumber = data.reservationNumber;
                }
            });
            
            return maxNumber + 1;
        } catch (error) {
            console.error('Error generating reservation number:', error);
            // Fallback: generar número basado en timestamp
            return parseInt(Date.now().toString().slice(-4));
        }
    }

    // Obtener reservas con listener en tiempo real
    static getReservations(
        callback: (reservations: Reservation[]) => void,
        accountId?: string,
        branchId?: string,
        status?: ReservationStatus
    ): () => void {
        let q = query(
            collection(db, this.COLLECTION_NAME),
            orderBy('date', 'desc')
        );

        // Agregar filtros según los parámetros
        const conditions = [];
        if (accountId) conditions.push(where('accountId', '==', accountId));
        if (branchId) conditions.push(where('branchId', '==', branchId));
        if (status) conditions.push(where('status', '==', status));

        if (conditions.length > 0) {
            q = query(
                collection(db, this.COLLECTION_NAME),
                ...conditions,
                orderBy('date', 'desc')
            );
        }

        return onSnapshot(q, (snapshot) => {
            const reservations: Reservation[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Reservation));
            
            callback(reservations);
        }, (error) => {
            console.error('Error listening to reservations:', error);
            callback([]);
        });
    }

    // Completar una reserva (convertir en venta)
    static async completeReservation(
        reservationId: string, 
        paymentMethod: string,
        saleId: string,
        finalPaymentAmount?: number
    ): Promise<void> {
        try {
            // Obtener la reserva para acceder a los items
            const reservation = await this.getReservation(reservationId);
            if (!reservation) {
                throw new Error('Reserva no encontrada');
            }

            if (reservation.status !== 'pending') {
                throw new Error('Solo se pueden completar reservas pendientes');
            }

            // Completar la reserva en el stock (mover stock reservado a venta real)
            const stockItems = reservation.items.map(item => ({
                productId: item.id,
                quantity: item.quantity,
                branchId: reservation.branchId
            }));

            const stockResult = await StockReservationService.completeReservation(
                stockItems, 
                reservation.accountId as string
            );

            if (!stockResult.success) {
                throw new Error(`Error al completar stock de reserva: ${stockResult.errors.join('; ')}`);
            }

            // Calcular totales para el registro completo
            const originalTotal = reservation.items.reduce((sum, item) => 
                sum + (item.price * item.quantity), 0) - reservation.discount;
            const totalPaid = (reservation.depositAmount || 0) + (finalPaymentAmount || 0);

            // Actualizar el estado de la reserva
            const reservationRef = doc(db, this.COLLECTION_NAME, reservationId);
            
            await updateDoc(reservationRef, {
                status: 'completed' as ReservationStatus,
                completedDate: Date.now(),
                paymentMethod,
                saleId,
                // Información adicional para registro completo
                finalPaymentAmount: finalPaymentAmount || 0,
                totalPaid: totalPaid,
                originalTotal: originalTotal
            });

            // Convertir depósito de reserva a venta real (si había depósito)
            if (reservation.depositAmount && reservation.depositAmount > 0) {
                await ReservationDepositService.convertDepositToSale(
                    reservationId,
                    saleId,
                    finalPaymentAmount || 0
                );
            }
        } catch (error) {
            console.error('Error completing reservation:', error);
            throw new Error('No se pudo completar la reserva');
        }
    }

    // Cancelar una reserva
    static async cancelReservation(reservationId: string, reason?: string): Promise<void> {
        try {
            // Obtener la reserva para acceder a los items
            const reservation = await this.getReservation(reservationId);
            if (!reservation) {
                throw new Error('Reserva no encontrada');
            }

            if (reservation.status !== 'pending') {
                throw new Error('Solo se pueden cancelar reservas pendientes');
            }

            // Liberar el stock reservado
            const stockItems = reservation.items.map(item => ({
                productId: item.id,
                quantity: item.quantity,
                branchId: reservation.branchId
            }));

            const stockResult = await StockReservationService.releaseReservedStock(
                stockItems, 
                reservation.accountId as string
            );

            if (!stockResult.success) {
                // Log el error pero no fallar completamente - la reserva debe cancelarse
                console.error('Error liberando stock reservado:', stockResult.errors);
            }

            // Actualizar el estado de la reserva
            const reservationRef = doc(db, this.COLLECTION_NAME, reservationId);
            
            const updateData: any = {
                status: 'cancelled' as ReservationStatus,
                cancelledDate: Date.now()
            };

            if (reason) {
                updateData.cancellationReason = reason;
            }

            await updateDoc(reservationRef, updateData);
        } catch (error) {
            console.error('Error cancelling reservation:', error);
            throw new Error('No se pudo cancelar la reserva');
        }
    }

    // Actualizar una reserva
    static async updateReservation(reservationId: string, updates: Partial<Reservation>): Promise<void> {
        try {
            const reservationRef = doc(db, this.COLLECTION_NAME, reservationId);
            await updateDoc(reservationRef, updates);
        } catch (error) {
            console.error('Error updating reservation:', error);
            throw new Error('No se pudo actualizar la reserva');
        }
    }

    // Obtener reservas vencidas (para mantenimiento automático)
    static async getExpiredReservations(accountId?: string): Promise<Reservation[]> {
        try {
            const now = Date.now();
            let q = query(
                collection(db, this.COLLECTION_NAME),
                where('status', '==', 'pending'),
                where('expiryDate', '<', now)
            );

            if (accountId) {
                q = query(
                    collection(db, this.COLLECTION_NAME),
                    where('accountId', '==', accountId),
                    where('status', '==', 'pending'),
                    where('expiryDate', '<', now)
                );
            }

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Reservation));
        } catch (error) {
            console.error('Error getting expired reservations:', error);
            return [];
        }
    }

    // Marcar reservas como vencidas
    static async expireReservations(reservationIds: string[]): Promise<void> {
        try {
            // Obtener todas las reservas que se van a vencer
            const reservations = await Promise.all(
                reservationIds.map(id => this.getReservation(id))
            );

            // Liberar el stock de cada reserva
            for (const reservation of reservations) {
                if (!reservation || reservation.status !== 'pending') continue;

                const stockItems = reservation.items.map(item => ({
                    productId: item.id,
                    quantity: item.quantity,
                    branchId: reservation.branchId
                }));

                const stockResult = await StockReservationService.releaseReservedStock(
                    stockItems, 
                    reservation.accountId as string
                );

                if (!stockResult.success) {
                    console.error(`Error liberando stock de reserva vencida ${reservation.id}:`, stockResult.errors);
                }
            }

            // Actualizar el estado de todas las reservas
            const promises = reservationIds.map(id => 
                updateDoc(doc(db, this.COLLECTION_NAME, id), {
                    status: 'expired' as ReservationStatus,
                    expiredDate: Date.now()
                })
            );
            
            await Promise.all(promises);
        } catch (error) {
            console.error('Error expiring reservations:', error);
            throw new Error('No se pudieron vencer las reservas');
        }
    }

    // Obtener una reserva específica
    static async getReservation(reservationId: string): Promise<Reservation | null> {
        try {
            const docRef = doc(db, this.COLLECTION_NAME, reservationId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                return {
                    id: docSnap.id,
                    ...docSnap.data()
                } as Reservation;
            }
            
            return null;
        } catch (error) {
            console.error('Error getting reservation:', error);
            return null;
        }
    }

    // Estadísticas de reservas
    static async getReservationStats(accountId: string, branchId?: string): Promise<{
        pending: number;
        completed: number;
        cancelled: number;
        expired: number;
        totalValue: number;
    }> {
        try {
            let q = query(
                collection(db, this.COLLECTION_NAME),
                where('accountId', '==', accountId)
            );

            if (branchId) {
                q = query(
                    collection(db, this.COLLECTION_NAME),
                    where('accountId', '==', accountId),
                    where('branchId', '==', branchId)
                );
            }

            const snapshot = await getDocs(q);
            const reservations = snapshot.docs.map(doc => doc.data() as Reservation);

            const stats = {
                pending: 0,
                completed: 0,
                cancelled: 0,
                expired: 0,
                totalValue: 0
            };

            reservations.forEach(reservation => {
                stats[reservation.status]++;
                if (reservation.status === 'pending') {
                    stats.totalValue += reservation.total;
                }
            });

            return stats;
        } catch (error) {
            console.error('Error getting reservation stats:', error);
            return {
                pending: 0,
                completed: 0,
                cancelled: 0,
                expired: 0,
                totalValue: 0
            };
        }
    }
}
