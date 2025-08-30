import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, setDoc, deleteDoc, DocumentData, QueryDocumentSnapshot, QuerySnapshot, query, where } from 'firebase/firestore';
import type { User } from '@/types/user';

const USERS_COLLECTION = 'users';

export const getUsers = (cb: (users: User[]) => void, accountId?: string) => {
  if (!accountId) {
    console.warn('getUsers called without accountId — skipping subscription to avoid unauthorized full-collection read');
    return () => { /* no-op unsubscribe */ };
  }
  const col = collection(db, USERS_COLLECTION);
  const q = query(col, where('accountId', '==', accountId));
  return onSnapshot(q as any, (snap: QuerySnapshot<DocumentData>) => {
    const users = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...(d.data() || {}) } as User));
    cb(users);
  }, (err) => {
    console.error('onSnapshot error (users query)', { errorCode: err && err.code, message: err && err.message });
  });
};


export const saveUser = async (user: User) => {
  if (user.id) {
    const ref = doc(db, USERS_COLLECTION, user.id);
    const { id, ...rest } = user;
    await setDoc(ref, rest as any, { merge: true });
    return user.id;
  }
  // Remove undefined fields (Firestore rejects undefined values) and omit `id` if present
  const { id, ...payload } = user as any;
  Object.keys(payload).forEach((k) => {
    if (payload[k] === undefined) delete payload[k];
  });
  const ref = await addDoc(collection(db, USERS_COLLECTION), payload as any);
  return ref.id;
};

export const deleteUser = async (id: string) => {
  await deleteDoc(doc(db, USERS_COLLECTION, id));
};

export default { getUsers, saveUser, deleteUser };
