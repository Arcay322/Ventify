import { db } from '@/lib/firebase';
import { CashRegisterSession } from '@/types/cash-register';
import { collection, addDoc, onSnapshot, query, where, limit, getDocs, doc, updateDoc, serverTimestamp, Timestamp, increment, getDoc, writeBatch, runTransaction } from 'firebase/firestore';

const CASH_REGISTER_COLLECTION = 'cash_register_sessions';

/**
 * Create a cash register session for a specific branch.
 * Uses a deterministic document id `active_{branchId}` to ensure only one active session per branch.
 */
export const createCashRegisterSession = async (branchId: string, initialAmount: number): Promise<boolean> => {
    const activeId = `active_${branchId}`;
    const sessionRef = doc(db, CASH_REGISTER_COLLECTION, activeId);
    try {
        return await runTransaction(db, async (tx) => {
            const snap = await tx.get(sessionRef);
            if (snap.exists() && snap.data()?.status === 'open') {
                // Already active for this branch
                return false;
            }
            const sessionData = {
                id: activeId,
                branchId,
                initialAmount,
                openTime: serverTimestamp(),
                status: 'open',
                totalSales: 0,
                cashSales: 0,
                cardSales: 0,
                digitalSales: 0,
            } as any;
            tx.set(sessionRef, sessionData);
            return true;
        });
    } catch (error) {
        console.error('Error creating cash register session in Firestore:', error);
        return false;
    }
};

export const getActiveCashRegisterSession = (callback: (session: CashRegisterSession | null) => void) => {
    const q = query(
        collection(db, CASH_REGISTER_COLLECTION), 
        where('status', '==', 'open'), 
        limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            callback(null);
            return;
        } 
        
        const doc = snapshot.docs[0];
        const data = doc.data();

        // The document might be delivered before the server timestamp is set.
        if (!data.openTime) {
            callback(null); // Return null and wait for the next snapshot with the timestamp.
            return; 
        }

        const session: CashRegisterSession = {
            id: doc.id,
            initialAmount: data.initialAmount,
            openTime: (data.openTime as Timestamp).toMillis(),
            status: data.status,
            totalSales: data.totalSales,
            cashSales: data.cashSales,
            cardSales: data.cardSales,
            digitalSales: data.digitalSales,
            closeTime: data.closeTime ? (data.closeTime as Timestamp).toMillis() : undefined,
            expectedAmount: data.expectedAmount,
            countedAmount: data.countedAmount,
            difference: data.difference,
        };
        callback(session);
        
    }, (error) => {
        console.error("Error getting active cash register session:", error);
        callback(null);
    });

    return unsubscribe;
};

export const addSaleToActiveSession = async (branchId: string, sale: { total: number; paymentMethod: string }) => {
    const sessionRef = doc(db, CASH_REGISTER_COLLECTION, `active_${branchId}`);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists() || sessionSnap.data()?.status !== 'open') {
        throw new Error('No hay una sesión de caja activa para registrar la venta.');
    }
    
    const updateData: { [key: string]: any } = {
        totalSales: increment(sale.total)
    };

    if (sale.paymentMethod === 'Efectivo') {
        updateData.cashSales = increment(sale.total);
    } else if (sale.paymentMethod === 'Tarjeta') {
        updateData.cardSales = increment(sale.total);
    } else if (sale.paymentMethod === 'Digital') {
        updateData.digitalSales = increment(sale.total);
    }

    await updateDoc(sessionRef, updateData);
};


export const closeCashRegisterSession = async (sessionId: string, countedAmount: number) => {
    const sessionRef = doc(db, CASH_REGISTER_COLLECTION, sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (!sessionDoc.exists()) {
        throw new Error("La sesión de caja no existe.");
    }

    const sessionData = sessionDoc.data() as Omit<CashRegisterSession, 'id' | 'openTime' | 'closeTime'> & { openTime: Timestamp };
    const expectedAmount = sessionData.initialAmount + sessionData.cashSales;
    const difference = countedAmount - expectedAmount;

    await updateDoc(sessionRef, {
        status: 'closed',
        closeTime: serverTimestamp(),
        countedAmount,
        expectedAmount,
        difference,
    });
};
