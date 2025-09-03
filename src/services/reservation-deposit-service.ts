import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, increment, getDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { activeSessionId, resolveAccountIdFromAuth } from './cash-register-service';

const RESERVATION_DEPOSITS_COLLECTION = 'reservation_deposits';

export interface ReservationDeposit {
    id: string;
    reservationId: string;
    reservationNumber: number;
    amount: number;
    paymentMethod: string;
    customerName: string;
    branchId: string;
    accountId: string;
    createdBy: string;
    date: number;
    status: 'active' | 'converted' | 'refunded'; // active = pendiente, converted = ya se convirtió en venta, refunded = devuelto
    convertedToSaleId?: string; // ID de la venta cuando se completa la reserva
    convertedDate?: number; // Fecha cuando se convirtió a venta
}

export class ReservationDepositService {
    
    /**
     * Registrar un depósito de reserva (NO es una venta aún)
     */
    static async recordReservationDeposit(
        reservationId: string,
        reservationNumber: number,
        amount: number,
        paymentMethod: string,
        customerName: string,
        branchId: string,
        accountId: string,
        createdBy: string
    ): Promise<string> {
        try {
            // 1. Registrar el depósito en la colección de depósitos
            const depositData: Omit<ReservationDeposit, 'id'> = {
                reservationId,
                reservationNumber,
                amount,
                paymentMethod,
                customerName,
                branchId,
                accountId,
                createdBy,
                date: Date.now(),
                status: 'active'
            };

            const depositDoc = await addDoc(collection(db, RESERVATION_DEPOSITS_COLLECTION), depositData);

            // 2. Registrar en la sesión de caja como DEPÓSITO (no venta)
            await this.addDepositToCashSession(branchId, accountId, {
                amount,
                paymentMethod,
                customerName,
                reservationNumber,
                depositId: depositDoc.id
            });

            return depositDoc.id;
        } catch (error) {
            console.error('Error recording reservation deposit:', error);
            throw new Error('No se pudo registrar el depósito de reserva');
        }
    }

    /**
     * Convertir depósito de reserva a venta real cuando se completa
     */
    static async convertDepositToSale(
        reservationId: string,
        saleId: string,
        finalPaymentAmount: number = 0
    ): Promise<void> {
        try {
            // Buscar el depósito activo de esta reserva
            const depositQuery = query(
                collection(db, RESERVATION_DEPOSITS_COLLECTION),
                where('reservationId', '==', reservationId),
                where('status', '==', 'active'),
                limit(1)
            );
            
            const depositSnapshot = await getDocs(depositQuery);

            if (depositSnapshot.empty) {
                // No hay depósito, significa que fue reserva sin adelanto
                return;
            }

            const depositDoc = depositSnapshot.docs[0];
            const depositData = depositDoc.data() as ReservationDeposit;

            // Marcar el depósito como convertido
            await updateDoc(depositDoc.ref, {
                status: 'converted',
                convertedToSaleId: saleId,
                convertedDate: Date.now()
            });

            // El dinero del depósito + pago final ya se registró como venta en addSaleToActiveSession
            // No necesitamos mover dinero, solo marcar la conversión
            
            console.log(`Depósito de S/${depositData.amount} convertido a venta ${saleId}`);
        } catch (error) {
            console.error('Error converting deposit to sale:', error);
            throw new Error('No se pudo convertir el depósito a venta');
        }
    }

    /**
     * Agregar depósito a la sesión de caja (separado de ventas)
     */
    private static async addDepositToCashSession(
        branchId: string, 
        accountId: string, 
        deposit: { 
            amount: number; 
            paymentMethod: string; 
            customerName: string; 
            reservationNumber: number;
            depositId: string;
        }
    ): Promise<void> {
        const resolvedAccountId = await resolveAccountIdFromAuth(accountId);
        if (!resolvedAccountId) throw new Error('No accountId available to add deposit to session');
        
        const activeId = activeSessionId(branchId, resolvedAccountId);
        const activeRef = doc(db, 'cash_register_sessions', activeId);
        const activeSnap = await getDoc(activeRef);
        
        if (!activeSnap.exists()) {
            console.warn('No active cash session to record deposit');
            return;
        }

        const actualSessionId = activeSnap.data()?.activeSessionId;
        if (!actualSessionId) return;

        const sessionRef = doc(db, 'cash_register_sessions', actualSessionId);
        const sessionSnap = await getDoc(sessionRef);
        
        if (!sessionSnap.exists() || sessionSnap.data()?.status !== 'open') {
            console.warn('Cash session not available for deposit recording');
            return;
        }

        // Registrar depósito separado de ventas
        const updateData: { [key: string]: any } = {
            totalReservationDeposits: increment(deposit.amount), // Nuevo campo
            reservationDepositsCount: increment(1) // Contador de depósitos
        };

        // Separar por método de pago en depósitos
        if (deposit.paymentMethod === 'Efectivo') {
            updateData.cashReservationDeposits = increment(deposit.amount);
        } else if (deposit.paymentMethod === 'Tarjeta') {
            updateData.cardReservationDeposits = increment(deposit.amount);
        } else if (deposit.paymentMethod === 'Digital') {
            updateData.digitalReservationDeposits = increment(deposit.amount);
        }

        await updateDoc(sessionRef, updateData);
    }

    /**
     * Obtener depósitos activos (pendientes de conversión)
     */
    static async getActiveDeposits(branchId: string, accountId: string): Promise<ReservationDeposit[]> {
        try {
            const depositQuery = query(
                collection(db, RESERVATION_DEPOSITS_COLLECTION),
                where('branchId', '==', branchId),
                where('accountId', '==', accountId),
                where('status', '==', 'active'),
                orderBy('date', 'desc')
            );
            
            const querySnapshot = await getDocs(depositQuery);

            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ReservationDeposit[];
        } catch (error) {
            console.error('Error getting active deposits:', error);
            return [];
        }
    }
}
