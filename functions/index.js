const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

// --- CORRECCIÓN APLICADA AQUÍ ---
// Se elimina la lógica compleja de inicialización y se reemplaza por esta línea.
// Esto permite que el SDK detecte automáticamente toda la configuración del proyecto
// (incluyendo la nueva región de la base de datos) desde el entorno de Cloud Functions.
admin.initializeApp();

const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Optional: automatic email sending for new users (reset link)
let sgMail;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || (functions.config && functions.config().sendgrid && functions.config().sendgrid.key);
const SENDGRID_FROM = process.env.SENDGRID_FROM || (functions.config && functions.config().sendgrid && functions.config().sendgrid.from) || 'no-reply@yourdomain.com';
// Firebase REST API key to call Identity Toolkit sendOobCode (not secret)
// Prefer env var, then NEXT_PUBLIC key, then functions config under allowed namespaces.
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY
  || process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  || (functions.config && functions.config().app && functions.config().app.api_key)
  || (functions.config && functions.config().firebase && functions.config().firebase.api_key);
if (SENDGRID_API_KEY) {
  try {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(SENDGRID_API_KEY);
  } catch (e) {
    console.warn('SendGrid not available; install @sendgrid/mail in functions to enable email sending');
    sgMail = null;
  }
}

// Helper: check caller is admin for the account (owner or custom claim admin)
async function assertCallerIsAccountAdmin(req, accountId) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) throw { status: 401, message: 'Unauthorized' };
  const idToken = authHeader.split(' ')[1];
  const decoded = await admin.auth().verifyIdToken(idToken);
	if (decoded.admin === true) return decoded.uid;
	// otherwise ensure that caller.uid is the owner of the account
	const acctSnap = await db.doc(`accounts/${accountId}`).get();
	if (!acctSnap.exists) throw { status: 404, message: 'Account not found' };
	const acct = acctSnap.data();
	if (acct.ownerUid && acct.ownerUid === decoded.uid) return decoded.uid;
	// Fallback: check users/{uid} doc role (allow admins created/managed via server-side to work without custom claims)
	try {
		const userSnap = await db.doc(`users/${decoded.uid}`).get();
		if (userSnap.exists) {
			const u = userSnap.data() || {};
			if (u.role === 'admin' || u.role === 'owner') return decoded.uid;
		}
	} catch (e) {
		console.warn('assertCallerIsAccountAdmin - failed reading users doc', { uid: decoded.uid, err: e && e.message });
	}
	// allow if caller has custom claim admin for this account (optional)
	throw { status: 403, message: 'Forbidden: requires admin' };
}

// Allows manager (for a specific branch) or admin/owner of account
async function assertCallerIsManagerOrAbove(req, accountId, branchId) {
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith('Bearer ')) throw { status: 401, message: 'Unauthorized' };
	const idToken = authHeader.split(' ')[1];
	const decoded = await admin.auth().verifyIdToken(idToken);
	if (decoded.admin === true) return decoded.uid;
	// owner check
	const acctSnap = await db.doc(`accounts/${accountId}`).get();
	if (!acctSnap.exists) throw { status: 404, message: 'Account not found' };
	const acct = acctSnap.data();
	if (acct.ownerUid && acct.ownerUid === decoded.uid) return decoded.uid;
	// manager fallback: check users/{uid} role and branchId
	try {
		const userSnap = await db.doc(`users/${decoded.uid}`).get();
		if (userSnap.exists) {
			const u = userSnap.data() || {};
			if (u.role === 'manager' && branchId && u.branchId === branchId) return decoded.uid;
			if (u.role === 'admin' || u.role === 'owner') return decoded.uid;
		}
	} catch (e) {
		console.warn('assertCallerIsManagerOrAbove - failed reading users doc', { uid: decoded.uid, err: e && e.message });
	}
	throw { status: 403, message: 'Forbidden: requires manager or admin' };
}

// POST /createUserForAccount
// body: { accountId, email, password, role, name, branchId }
app.post('/createUserForAccount', async (req, res) => {
  try {
 const { accountId, email, password, role = 'worker', name, branchId } = req.body;
  // Debug: log incoming request body so we can see what the client sent
  console.debug('createUserForAccount received body:', req.body);
  // password is optional: if not provided, we will create the user without password and send a reset link
  if (!accountId || !email) {
    console.warn('createUserForAccount missing fields:', { accountId, email, password });
    return res.status(400).json({ error: 'accountId and email required', received: req.body });
  }

    // verify caller privileges
    await assertCallerIsAccountAdmin(req, accountId);

    const accountRef = db.doc(`accounts/${accountId}`);

    // run transaction to check limits and reserve seat
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(accountRef);
      if (!snap.exists) throw { status: 404, message: 'Account not found' };
      const account = snap.data();
      const limits = account.limits || { admins: 1, workers: 4 };
      const counts = account.counts || { admins: 0, workers: 0 };
      const seat = (role === 'owner' || role === 'admin') ? 'admins' : 'workers';
      if ((counts[seat] || 0) + 1 > (limits[seat] || 0)) {
        throw { status: 409, message: `limit_exceeded for ${seat}` };
      }
      // increment provisional count
      const newCounts = { ...counts, [seat]: (counts[seat] || 0) + 1 };
      tx.update(accountRef, { counts: newCounts });
      return { provisionalCounts: newCounts };
    });

    // create user in Auth. Password may be optional; if not provided create user without password
    let userRecord;
    if (password && password.length > 0) {
      userRecord = await admin.auth().createUser({ email, password });
    } else {
      // create user without password and generate a password reset link to send to the employee
      userRecord = await admin.auth().createUser({ email });
    }

		// create users doc (server-side, bypasses rules)
		try {
			// Persist optional name and branchId provided by the caller so UI selections are saved.
			await db.doc(`users/${userRecord.uid}`).set({
				email,
				role,
				accountId,
				name: name || null,
				branchId: branchId || null,
				createdAt: admin.firestore.FieldValue.serverTimestamp(),
			});
		} catch (err) {
      console.error('Failed writing users doc (createUserForAccount)', {
        uid: userRecord && userRecord.uid,
        errCode: err && err.code,
        errMessage: err && err.message,
        errDetails: err && err.details,
        stack: err && err.stack,
      });
      throw err;
    }

    // Optionally set custom claim for admin/owner
		// Always set accountId as a custom claim so security rules can validate without reading users/{uid}
		try {
			const claims = { accountId };
			if (role === 'admin' || role === 'owner') claims.admin = true;
			await admin.auth().setCustomUserClaims(userRecord.uid, claims);
		} catch (e) {
			console.warn('Failed to set custom claims for', userRecord.uid, e && e.message);
		}

    // If password was not provided, generate a password reset link, attempt to email it, and return result
    if (!password || password.length === 0) {
      // Preferred: ask Firebase to send the OOB (PASSWORD_RESET) via REST API
      if (FIREBASE_API_KEY) {
        try {
          const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`;
          const body = { requestType: 'PASSWORD_RESET', email };
          // Node has global fetch in modern runtimes; fallback to admin-generated link if not available
          if (typeof fetch === 'function') {
            const resp = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
            if (resp.ok) {
              return res.json({ uid: userRecord.uid, emailed: true });
            }
            const text = await resp.text();
            console.warn('Firebase sendOobCode failed', resp.status, text);
          }
        } catch (restErr) {
          console.warn('sendOobCode error', restErr);
        }
        // If REST send failed or fetch not available, continue to fallback below
      }

      // Fallback: generate the reset link with Admin SDK and return it (caller can deliver)
      try {
        const link = await admin.auth().generatePasswordResetLink(email);
        return res.json({ uid: userRecord.uid, resetLink: link });
      } catch (e) {
        console.error('generatePasswordResetLink error', e);
        return res.json({ uid: userRecord.uid });
      }
    }

    return res.json({ uid: userRecord.uid });
  } catch (e) {
    // best-effort cleanup: if we reserved seat but failed to create user, decrement counts
    if (e && e.status) return res.status(e.status).json({ error: e.message || e });
    console.error('createUserForAccount error', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
});

// POST /deleteUserForAccount
// body: { uid }
// Requires Authorization: Bearer <idToken> from an account admin.
app.post('/deleteUserForAccount', async (req, res) => {
  try {
    const { uid } = req.body || {};
    console.debug('deleteUserForAccount received body:', req.body);
    if (!uid) return res.status(400).json({ error: 'uid required' });

    // read user doc to find accountId and role
    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists) return res.status(404).json({ error: 'user not found' });
    const userDoc = userSnap.data() || {};
    const accountId = userDoc.accountId;
    const role = userDoc.role || 'worker';
    if (!accountId) return res.status(400).json({ error: 'user has no accountId' });

    // verify caller privileges for the account
    await assertCallerIsAccountAdmin(req, accountId);

    const accountRef = db.doc(`accounts/${accountId}`);

    // decrement counts transactionally (never go below 0)
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(accountRef);
      if (!snap.exists) throw { status: 404, message: 'Account not found' };
      const account = snap.data();
      const counts = account.counts || { admins: 0, workers: 0 };
      const seat = (role === 'owner' || role === 'admin') ? 'admins' : 'workers';
      const current = counts[seat] || 0;
      const newCount = Math.max(current - 1, 0);
      const newCounts = { ...(counts || {}), [seat]: newCount };
      tx.update(accountRef, { counts: newCounts });
    });

    // delete users doc
    try {
      await db.doc(`users/${uid}`).delete();
    } catch (e) {
      console.warn('Failed to delete users doc for', uid, e);
    }

    // attempt to delete Auth user (best-effort)
    try {
      await admin.auth().deleteUser(uid);
    } catch (e) {
      console.warn('Failed to delete auth user', uid, e);
    }

    return res.json({ uid, deleted: true });
  } catch (e) {
    if (e && e.status) return res.status(e.status).json({ error: e.message || e });
    console.error('deleteUserForAccount error', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
});

// POST /publicSignup
// body: { businessName, ownerName, email, password }
// Public endpoint used by the frontend signup page to create a new account + owner user.
// This endpoint is intentionally public to allow self-service signups. It will:
//  - create an accounts/{accountId} document
//  - create a Firebase Auth user with role owner
//  - create users/{uid} doc with role=owner and accountId
// Note: This endpoint should be rate-limited and protected by recaptcha in production.
app.post('/publicSignup', async (req, res) => {
  try {
    const { businessName, ownerName, email, password } = req.body;
    if (!businessName || !email || !password) return res.status(400).json({ error: 'businessName,email,password required' });

    // create a deterministic account id (slugified businessName + timestamp short)
    const accountId = `acct_${Date.now()}_${businessName.replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '')}`;

    // run transaction: create account doc and create auth user and users doc
    // Note: Firebase Admin SDK does not participate in Firestore transactions for auth creation,
    // so we create the account doc first, then the auth user, then update account ownerUid.

    const accountRef = db.doc(`accounts/${accountId}`);
    try {
      // Diagnostic logs to help debug project/credential mismatches that can cause NOT_FOUND
      try {
        console.debug('publicSignup debug - admin app projectId:', admin.app && admin.app().options && admin.app().options.projectId);
      } catch (e) {
        console.debug('publicSignup debug - admin.app() not available yet');
      }
      console.debug('publicSignup debug - FIREBASE_CONFIG env:', process.env.FIREBASE_CONFIG ? '[present]' : '[missing]');
      console.debug('publicSignup debug - GCLOUD_PROJECT env:', process.env.GCLOUD_PROJECT || '[missing]');
      console.debug('publicSignup debug - serviceAccountEmail runtime:', process.env.FUNCTION_IDENTITY || process.env.SERVICE_ACCOUNT_EMAIL || '[unknown]');

      // Extra diagnostics: list root collections and perform a simple read to ensure Firestore client can reach the DB
      try {
        const cols = await db.listCollections();
        console.debug('publicSignup debug - root collections count:', Array.isArray(cols) ? cols.length : '[unknown]');
      } catch (listErr) {
        console.error('publicSignup debug - listCollections failed', { message: listErr && listErr.message, code: listErr && listErr.code });
      }
      try {
        // attempt a quick read of a known-or-empty path to detect permission/project issues
        const metaSnap = await db.doc('__diagnostics__/probe').get();
        console.debug('publicSignup debug - probe doc exists:', metaSnap.exists);
      } catch (readErr) {
        console.error('publicSignup debug - probe read failed', { message: readErr && readErr.message, code: readErr && readErr.code });
      }

      await accountRef.set({ name: businessName, createdAt: Date.now(), limits: { admins: 1, workers: 4 }, counts: { admins: 1, workers: 0 }, ownerUid: null });
    } catch (err) {
      console.error('Failed writing account doc (publicSignup)', {
        businessName,
        errCode: err && err.code,
        errMessage: err && err.message,
        errDetails: err && err.details,
        stack: err && err.stack,
      });
      throw err;
    }

    // create Auth user as owner
    const userRecord = await admin.auth().createUser({ email, password, displayName: ownerName });

    // set custom claim admin
    await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });

		// create users doc
		try {
			await db.doc(`users/${userRecord.uid}`).set({
				email,
				role: 'owner',
				accountId,
				name: ownerName,
				createdAt: admin.firestore.FieldValue.serverTimestamp(),
			});
		} catch (err) {
      console.error('Failed writing users doc (publicSignup)', {
        uid: userRecord && userRecord.uid,
        errCode: err && err.code,
        errMessage: err && err.message,
        errDetails: err && err.details,
        stack: err && err.stack,
      });
      throw err;
    }

    // set ownerUid on account
    await accountRef.update({ ownerUid: userRecord.uid });

    return res.json({ accountId, uid: userRecord.uid });
  } catch (e) {
    console.error('publicSignup error', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
});

exports.api = functions.https.onRequest(app);