import { db, auth } from '@/lib/firebase';
import { CashRegisterSession } from '@/types/cash-register';
import { collection, addDoc, onSnapshot, query, where, limit, getDocs, doc, updateDoc, serverTimestamp, Timestamp, increment, getDoc, writeBatch, runTransaction, QuerySnapshot, DocumentData, orderBy } from 'firebase/firestore';

const CASH_REGISTER_COLLECTION = 'cash_register_sessions';

/**
 * Build a deterministic active session id scoped to account + branch.
 */
export const activeSessionId = (branchId: string, accountId?: string) => `active_${accountId ?? 'global'}_${branchId}`;

// Try to resolve accountId from provided value or from the signed-in user's ID token claims.
export const resolveAccountIdFromAuth = async (accountId?: string) => {
    if (accountId) return accountId;
    try {
        const current = auth.currentUser;
        if (!current) return undefined;
        const token = await current.getIdTokenResult().catch(() => null);
        if (token && token.claims && token.claims.accountId) return token.claims.accountId;
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
    const activeId = activeSessionId(branchId, resolvedAccountId);
    const sessionRef = doc(db, CASH_REGISTER_COLLECTION, activeId);
    try { 
        console.info('[cash-register] attempting createCashRegisterSession', { activeId, branchId, accountId, initialAmount, userId }); 
    } catch (e) { /* ignore logging errors */ }

    // Diagnostic: log the currently authenticated user and token claims (if available)
    try {
        const currentUid = auth.currentUser?.uid;
        try { console.info('[cash-register] auth.currentUser?.uid', currentUid); } catch(e){}
        if (auth.currentUser && typeof auth.currentUser.getIdTokenResult === 'function') {
            // Do not force refresh by default; we want to inspect the current token
            const tokenResult = await auth.currentUser.getIdTokenResult().catch(() => null);
            try { console.debug('[cash-register] idToken claims', tokenResult ? tokenResult.claims : null); } catch(e){}
            if (tokenResult && tokenResult.claims && tokenResult.claims.admin) {
                try { console.info('[cash-register] token has admin claim'); } catch(e){}
            }
        }
        if (currentUid && userId && currentUid !== userId) {
            try { console.warn('[cash-register] WARNING: auth.currentUser.uid does not match passed userId', { currentUid, userId }); } catch(e){}
        }
    } catch (e) {
        // non critical diagnostics
    }
    try {
        return await runTransaction(db, async (tx) => {
            const snap = await tx.get(sessionRef);
            try { console.debug('[cash-register] tx.get snapshot exists:', snap.exists(), 'data:', snap.exists() ? snap.data() : null); } catch(e){}
            if (snap.exists() && snap.data()?.status === 'open') {
                // Already active for this branch/account
                return false;
            }
            const sessionData = {
                id: activeId,
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
        try {
            console.info('[cash-register] getActiveCashRegisterSession created query', { branchId, accountId: resolvedAccountId });
        } catch (e) {}

        unsubscribe = onSnapshot(q as any, (snapshot: QuerySnapshot<DocumentData>) => {
        try { console.debug('[cash-register] onSnapshot docs:', snapshot.docs.map(d => ({ id: d.id, data: d.data() }))); } catch(e){}
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
            startQuery(resolved).catch(() => callback(null));
        })();
    }

    return () => { try { unsubscribe(); } catch (e) { } };
};

export const addSaleToActiveSession = async (branchId: string, accountId: string | undefined, sale: { total: number; paymentMethod: string }) => {
    const resolvedAccountId = await resolveAccountIdFromAuth(accountId);
    if (!resolvedAccountId) throw new Error('No accountId available to add sale to session');
    const sessionRef = doc(db, CASH_REGISTER_COLLECTION, activeSessionId(branchId, resolvedAccountId));
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

        // create a closure report document snapshot
        const reportRef = doc(collection(db, 'cash_register_reports'));
        const report = {
            sessionId,
            sessionSnapshot: sessionData,
            countedAmount,
            expectedAmount,
            difference,
            createdAt: serverTimestamp(),
        } as any;
        tx.set(reportRef, report);
    });
    // return report id would be nice but callers can query reports by sessionId
};
