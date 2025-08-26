import { db } from '@/lib/firebase';
import { CashRegisterSession } from '@/types/cash-register';
import { collection, addDoc, onSnapshot, query, where, limit, getDocs, doc, updateDoc, serverTimestamp, Timestamp, increment, getDoc, writeBatch } from 'firebase/firestore';

const CASH_REGISTER_COLLECTION = 'cash_register_sessions';

export const createCashRegisterSession = async (initialAmount: number): Promise<boolean> => {
    const activeSessionQuery = query(
        collection(db, CASH_REGISTER_COLLECTION), 
        where('status', '==', 'open'), 
        limit(1)
    );

    try {
        const activeSessionSnapshot = await getDocs(activeSessionQuery);
        if (!activeSessionSnapshot.empty) {
            console.error("Attempted to create a session, but one is already active.");
            return false; // Indicate failure due to existing session
        }

        const sessionData = {
            initialAmount,
            openTime: serverTimestamp(),
            status: 'open',
            totalSales: 0,
            cashSales: 0,
            cardSales: 0,
            digitalSales: 0,
        };
        await addDoc(collection(db, CASH_REGISTER_COLLECTION), sessionData);
        return true; // Indicate success
    } catch (error) {
        console.error("Error creating cash register session in Firestore:", error);
        return false; // Indicate failure
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

export const addSaleToActiveSession = async (sale: { total: number; paymentMethod: string }) => {
    const q = query(
        collection(db, CASH_REGISTER_COLLECTION), 
        where('status', '==', 'open'), 
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        throw new Error("No hay una sesión de caja activa para registrar la venta.");
    }
    const sessionRef = snapshot.docs[0].ref;
    
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
