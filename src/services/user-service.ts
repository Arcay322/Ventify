import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, setDoc, deleteDoc, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

const USERS_COLLECTION = 'users';

export const getUsers = (cb: (users: any[]) => void) => {
  const col = collection(db, USERS_COLLECTION);
  return onSnapshot(col, (snap) => {
    const users = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...(d.data() || {}) }));
    cb(users);
  });
};

export const saveUser = async (user: any) => {
  if (user.id) {
    const ref = doc(db, USERS_COLLECTION, user.id);
    const { id, ...rest } = user;
    await setDoc(ref, rest, { merge: true });
    return user.id;
  }
  const ref = await addDoc(collection(db, USERS_COLLECTION), user);
  return ref.id;
};

export const deleteUser = async (id: string) => {
  await deleteDoc(doc(db, USERS_COLLECTION, id));
};

export default { getUsers, saveUser, deleteUser };
