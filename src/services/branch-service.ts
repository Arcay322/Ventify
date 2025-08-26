import { db } from '@/lib/firebase';
import { Branch } from '@/types/branch';
import { collection, onSnapshot, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

const BRANCHES_COLLECTION = 'branches';

const branchFromDoc = (doc: QueryDocumentSnapshot<DocumentData>): Branch => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    address: data.address,
  };
};

export const getBranches = (callback: (branches: Branch[]) => void) => {
  const branchesCollection = collection(db, BRANCHES_COLLECTION);
  const unsubscribe = onSnapshot(branchesCollection, (snapshot) => {
    const branches = snapshot.docs.map(branchFromDoc);
    callback(branches);
  });
  return unsubscribe;
};

import { addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export const saveBranch = async (branch: Partial<Branch> & { id?: string }) => {
  if (branch.id) {
    const branchRef = doc(db, BRANCHES_COLLECTION, branch.id);
    const { id, ...branchData } = branch;
    await updateDoc(branchRef, branchData as any);
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
