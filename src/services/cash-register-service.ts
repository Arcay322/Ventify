import { db, auth } from '@/lib/firebase';
import { CashRegisterSession } from '@/types/cash-register';
import { collection, addDoc, onSnapshot, query, where, limit, getDocs, doc, updateDoc, serverTimestamp, Timestamp, increment, getDoc, writeBatch, runTransaction, QuerySnapshot, DocumentData, orderBy } from 'firebase/firestore';

const CASH_REGISTER_COLLECTION = 'cash_register_sessions';

/**
 * Build a deterministic active session id scoped to account + branch.
 */
export const activeSessionId = (branchId: string, accountId?: string) => `active_${accountId ?? 'global'}_${branchId}`;

// Try to resolve accountId from provided value or from the signed-in user's ID token claims.
export const resolveAccountIdFromAuth = async (accountId?: string): Promise<string | undefined> => {
    if (accountId) return accountId;
    try {
        const current = auth.currentUser;
        if (!current) return undefined;
        const token = await current.getIdTokenResult().catch(() => null);
    if (token && token.claims && typeof token.claims.accountId === 'string') return token.claims.accountId as string;
    } catch (e) {
        // ignore
    }
    return undefined;
}

/**
 * Create a cash register session for a specific branch and account.
 * Ensures only one active session per (account, branch) using a transaction.
 */
export const createCashRegisterSession = async (branchId: string, initialAmount: number, userId?: string, accountId?: string): Promise<boolean> => {
    const resolvedAccountId = await resolveAccountIdFromAuth(accountId);
    if (!resolvedAccountId) {
        console.error('[cash-register] createCashRegisterSession: missing accountId (pass accountId or ensure token has accountId claim)');
        return false;
    }
    
    // Generate a unique ID for each session instead of reusing the same "active" ID
    const uniqueId = `session_${resolvedAccountId}_${branchId}_${Date.now()}`;
    const sessionRef = doc(db, CASH_REGISTER_COLLECTION, uniqueId);
    
    try {
        return await runTransaction(db, async (tx) => {
            // Check if there's already an active session for this branch/account
            // Search by status='open' instead of relying on the active pointer
            const coll = collection(db, CASH_REGISTER_COLLECTION);
            const activeQuery = query(
                coll, 
                where('branchId', '==', branchId), 
                where('accountId', '==', resolvedAccountId), 
                where('status', '==', 'open'), 
                limit(1)
            );
            
            const activeSnap = await getDocs(activeQuery);
            if (!activeSnap.empty) {
                // Already active for this branch/account
                console.log('Active session found:', activeSnap.docs[0].id);
                return false;
            }
            
            const sessionData = {
                id: uniqueId,
                branchId,
                accountId: resolvedAccountId,
                startedBy: userId ?? null,
                initialAmount,
                openTime: serverTimestamp(),
                status: 'open',
                totalSales: 0,
                cashSales: 0,
                cardSales: 0,
                digitalSales: 0,
            } as any;
            tx.set(sessionRef, sessionData);
            
            // Also create/update the "active" pointer document
            const activeId = activeSessionId(branchId, resolvedAccountId);
            const activeSessionRef = doc(db, CASH_REGISTER_COLLECTION, activeId);
            tx.set(activeSessionRef, {
                activeSessionId: uniqueId,
                branchId,
                accountId: resolvedAccountId,
                lastUpdated: serverTimestamp()
            });
            
            return true;
        });
    } catch (error) {
        console.error('Error creating cash register session in Firestore:', error);
        return false;
    }
};

/**
 * Subscribe to the active cash register session for a given branch/account.
 * If branchId is omitted, returns the first open session for the account (or any open session if accountId is also omitted).
 */
export const getActiveCashRegisterSession = (branchId: string | undefined, accountId: string | undefined, callback: (session: CashRegisterSession | null) => void) => {
    let unsubscribe: (() => void) = () => { };
    const coll = collection(db, CASH_REGISTER_COLLECTION);

    const startQuery = async (resolvedAccountId?: string) => {
        let q;
        // require accountId to avoid cross-account matches. If we don't have one, bail out as "no active session".
        if (!resolvedAccountId) {
            try { console.warn('[cash-register] getActiveCashRegisterSession: no accountId available, returning null'); } catch (e) { }
            callback(null);
            return;
        }
        if (branchId && resolvedAccountId) {
            q = query(coll, where('branchId', '==', branchId), where('accountId', '==', resolvedAccountId), where('status', '==', 'open'), limit(1));
        } else if (resolvedAccountId) {
            q = query(coll, where('accountId', '==', resolvedAccountId), where('status', '==', 'open'), limit(1));
        }

        unsubscribe = onSnapshot(q as any, (snapshot: QuerySnapshot<DocumentData>) => {
        if (snapshot.empty) {
            callback(null);
            return;
        }

        const docSnap = snapshot.docs[0];
        const data = docSnap.data();

        // The document might be delivered before the server timestamp is set.
        if (!data.openTime) {
            callback(null);
            return;
        }

        const session: CashRegisterSession = {
            id: docSnap.id,
            branchId: data.branchId,
            accountId: data.accountId,
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
        } as CashRegisterSession;
        callback(session);

        }, (error: any) => {
            console.error("onSnapshot error (cash_register_sessions query)", { errorCode: error && error.code, message: error && error.message });
            callback(null);
        });
    };

    // If caller provided an accountId, start immediately; otherwise try to resolve from auth token.
    if (accountId) {
        startQuery(accountId).catch(() => callback(null));
    } else {
        // resolve from auth token asynchronously
        (async () => {
            const resolved = await resolveAccountIdFromAuth();
            const resolvedStr: string | undefined = typeof resolved === 'string' ? resolved : undefined;
            startQuery(resolvedStr).catch(() => callback(null));
        })();
    }

    return () => { try { unsubscribe(); } catch (e) { } };
};

export const addSaleToActiveSession = async (branchId: string, accountId: string | undefined, sale: { total: number; paymentMethod: string; itemCount?: number; customerName?: string; saleNumber?: number }) => {
    const resolvedAccountId = await resolveAccountIdFromAuth(accountId);
    if (!resolvedAccountId) throw new Error('No accountId available to add sale to session');
    const activeId = activeSessionId(branchId, resolvedAccountId);
    const activeRef = doc(db, CASH_REGISTER_COLLECTION, activeId);
    const activeSnap = await getDoc(activeRef);
    if (!activeSnap.exists()) {
        // No hay sesión activa - esto es normal si no se ha abierto caja
        return;
    }

    // Get the actual session ID from the active pointer
    const actualSessionId = activeSnap.data()?.activeSessionId;
    if (!actualSessionId) {
        console.warn('Active session document exists but has no activeSessionId');
        return;
    }

    // Update the actual session document
    const sessionRef = doc(db, CASH_REGISTER_COLLECTION, actualSessionId);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists() || sessionSnap.data()?.status !== 'open') {
        console.warn('Actual session does not exist or is not open');
        return;
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

    // Registrar movimiento de caja individual para todas las ventas
    let description = `Venta - ${sale.paymentMethod}`;
    
    // Agregar número de items si está disponible
    if (sale.itemCount && sale.itemCount > 0) {
        description += ` (${sale.itemCount} item${sale.itemCount > 1 ? 's' : ''})`;
    }
    
    // Agregar cliente si está disponible
    if (sale.customerName) {
        description += ` - ${sale.customerName}`;
    }
    
    // Agregar número de venta si está disponible
    if (sale.saleNumber) {
        description += ` #${sale.saleNumber.toString()}`;
    }
    
    await createCashMovement(actualSessionId, sale.total, description, resolvedAccountId);
};

/**
 * Register a cash movement (ingreso or retiro) linked to a session.
 * amount: positive for ingreso, negative for retiro.
 */
export const createCashMovement = async (sessionId: string, amount: number, reason: string, accountId?: string) => {
    const movementsCol = collection(db, 'cash_register_movements');
    const movement = {
        sessionId,
        amount,
        reason: reason || '',
        accountId: accountId ?? null,
        createdAt: serverTimestamp(),
    } as any;

    // write movement and update session expectedAmount atomically
    const sessionRef = doc(db, CASH_REGISTER_COLLECTION, sessionId);
    try {
        await runTransaction(db, async (tx) => {
            const mvRef = doc(movementsCol);
            tx.set(mvRef, movement);
            tx.update(sessionRef, { expectedAmount: increment(amount) });
        });
    } catch (e) {
        console.error('Failed to register cash movement', e);
        throw e;
    }
}

export const getMovementsForSession = (sessionId: string, callback: (movements: any[]) => void) => {
    const coll = collection(db, 'cash_register_movements');
    const q = query(coll, where('sessionId', '==', sessionId), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q as any, (snap: QuerySnapshot<DocumentData>) => {
        const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        callback(items);
    }, (err) => {
        console.error('onSnapshot error (cash_register_movements)', err);
        callback([]);
    });
    return unsub;
}


export const closeCashRegisterSession = async (sessionId: string, countedAmount: number) => {
    const sessionRef = doc(db, CASH_REGISTER_COLLECTION, sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (!sessionDoc.exists()) {
        throw new Error("La sesión de caja no existe.");
    }

    const sessionData = sessionDoc.data() as any;
    // Get all movements for this session before closing
    const movementsQuery = query(
        collection(db, 'cash_register_movements'),
        where('sessionId', '==', sessionId)
    );
    const movementsSnap = await getDocs(movementsQuery);
    const movements = movementsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Prefer stored expectedAmount (updated by movements) else compute
    const expectedAmount = typeof sessionData.expectedAmount === 'number'
        ? sessionData.expectedAmount
        : (sessionData.initialAmount || 0) + (sessionData.cashSales || 0);
    const difference = countedAmount - expectedAmount;

    await runTransaction(db, async (tx) => {
        tx.update(sessionRef, {
            status: 'closed',
            closeTime: serverTimestamp(),
            countedAmount,
            expectedAmount,
            difference,
        });

        // create a closure report document snapshot with movements included
        const reportRef = doc(collection(db, 'cash_register_reports'));
        const report = {
            sessionId,
            sessionSnapshot: sessionData,
            movements, // Include movements in the report
            countedAmount,
            expectedAmount,
            difference,
            createdAt: serverTimestamp(),
            accountId: sessionData.accountId, // Include for filtering
        } as any;
        tx.set(reportRef, report);
    });
    
    return { reportId: sessionId, movements }; // Return movements for immediate display
};

// Get a specific cash register report by session ID
export const getCashRegisterReport = async (sessionId: string): Promise<any> => {
    const reportsQuery = query(
        collection(db, 'cash_register_reports'),
        where('sessionId', '==', sessionId),
        limit(1)
    );
    const reportSnap = await getDocs(reportsQuery);
    
    if (reportSnap.empty) {
        throw new Error('Reporte no encontrado');
    }
    
    const reportData = reportSnap.docs[0].data();
    return { id: reportSnap.docs[0].id, ...reportData };
};

// Get all cash register reports for an account
export const getCashRegisterReports = (callback: (reports: any[]) => void, accountId?: string) => {
    if (!accountId) {
        callback([]);
        return () => {};
    }

    const reportsQuery = query(
        collection(db, 'cash_register_reports'),
        where('accountId', '==', accountId),
        orderBy('createdAt', 'desc'),
        limit(50)
    );

    return onSnapshot(reportsQuery, (snapshot) => {
        const reports = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(reports);
    }, (error) => {
        console.error('Error fetching cash register reports:', error);
        callback([]);
    });
};
