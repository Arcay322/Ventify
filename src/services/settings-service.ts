import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

const SETTINGS_COLLECTION = 'settings';
const GLOBAL_DOC = 'global';

export type Settings = {
  currency?: string;
  locale?: string;
  timezone?: string;
  [key: string]: unknown;
}

export const getSettings = async (): Promise<Settings | null> => {
  const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_DOC);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Settings) : null;
};

export const subscribeSettings = (cb: (data: Settings | null) => void) => {
  const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_DOC);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? (snap.data() as Settings) : null), (err) => {
    console.error('onSnapshot error (settings doc)', { errorCode: err && err.code, message: err && err.message });
  });
};

export const saveSettings = async (data: Settings) => {
  const ref = doc(db, SETTINGS_COLLECTION, GLOBAL_DOC);
  await setDoc(ref, { ...data, updatedAt: Date.now() }, { merge: true });
};

export default { getSettings, subscribeSettings, saveSettings };
