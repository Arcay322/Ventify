import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

const USERS_COLLECTION = 'users';

export const signup = async (email: string, password: string, displayName?: string, role: 'owner' | 'admin' | 'cashier' = 'cashier', branchId?: string) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  // Mirror profile in users collection for roles and metadata
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  await setDoc(userRef, { email: user.email, displayName: displayName || user.displayName || null, role, branchId, createdAt: Date.now() });
  return user;
};

export const login = async (email: string, password: string) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
};

export const logout = async () => {
  await signOut(auth);
};

export const onAuthChange = (cb: (user: User | null) => void) => {
  return onAuthStateChanged(auth, cb);
};

export const getUserDoc = async (uid: string) => {
  const ref = doc(db, USERS_COLLECTION, uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

export const subscribeUserDoc = (uid: string, cb: (data: any) => void) => {
  const ref = doc(db, USERS_COLLECTION, uid);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : null));
};

export default {
  signup,
  login,
  logout,
  onAuthChange,
  getUserDoc,
  subscribeUserDoc,
};
