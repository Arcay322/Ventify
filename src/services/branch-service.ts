import { db } from '@/lib/firebase';
import { Branch } from '@/types/branch';
import { collection, onSnapshot, DocumentData, QueryDocumentSnapshot, QuerySnapshot, query, where, getDocs } from 'firebase/firestore';
import { getDoc } from 'firebase/firestore';

const BRANCHES_COLLECTION = 'branches';

const branchFromDoc = (doc: QueryDocumentSnapshot<any>): Branch => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    address: data.address,
  };
};

export const getBranches = (callback: (branches: Branch[]) => void, accountId?: string) => {
  const branchesCollection = collection(db, BRANCHES_COLLECTION);
  const q = accountId ? query(branchesCollection, where('accountId', '==', accountId)) : branchesCollection;
  // Fire a one-time fetch so callers get immediate results for UI render, then subscribe for live updates.
  (async () => {
    try {
      const snap = await getDocs(q as any);
      const initial = snap.docs.map(branchFromDoc);
      callback(initial);
    } catch (e) {
      // ignore one-off failure; onSnapshot will still handle live updates
    }
  })();

  const unsubscribe = onSnapshot(q as any, (snapshot: QuerySnapshot<DocumentData>) => {
    const branches = snapshot.docs.map(branchFromDoc);
    callback(branches);
  });
  return unsubscribe;
};

import { addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';

export const saveBranch = async (branch: Partial<Branch> & { id?: string }) => {
  if (branch.id) {
    const branchRef = doc(db, BRANCHES_COLLECTION, branch.id);
    const { id, ...branchData } = branch;
  // Use setDoc with merge so we can create-or-update safely even if the doc didn't exist yet.
  await setDoc(branchRef, branchData as any, { merge: true });
  return branch.id;
  } else {
    const { id, ...branchData } = branch;
    const docRef = await addDoc(collection(db, BRANCHES_COLLECTION), branchData as any);
    return docRef.id;
  }
};

export const deleteBranch = async (branchId: string) => {
  const branchRef = doc(db, BRANCHES_COLLECTION, branchId);
  await deleteDoc(branchRef);
};

export const getBranchById = async (branchId: string) => {
  if (!branchId) return null;
  const ref = doc(db, BRANCHES_COLLECTION, branchId);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as any) : null;
};

// Promise-based version for easier async/await usage
export const getBranchesAsync = async (accountId?: string): Promise<Branch[]> => {
  const branchesCollection = collection(db, BRANCHES_COLLECTION);
  const q = accountId ? query(branchesCollection, where('accountId', '==', accountId)) : branchesCollection;
  const snapshot = await getDocs(q);
  return snapshot.docs.map(branchFromDoc);
};

// Export as a service object for cleaner imports
export const BranchService = {
  getBranches,
  getBranchesAsync,
  saveBranch,
  deleteBranch,
  getBranchById
};
