import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

const SETTINGS_COLLECTION = 'settings';
const GLOBAL_DOC = 'global';

export const getSettings = async () => {
  const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_DOC);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

export const subscribeSettings = (cb: (data: any) => void) => {
  const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_DOC);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : null));
};

export const saveSettings = async (data: any) => {
  const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_DOC);
  await setDoc(ref, { ...data, updatedAt: Date.now() }, { merge: true });
};

export default { getSettings, subscribeSettings, saveSettings };
