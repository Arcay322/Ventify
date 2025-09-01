import { db } from '@/lib/firebase';
import { Customer } from '@/types/customer';
import { collection, onSnapshot, DocumentData, QueryDocumentSnapshot, query, where } from 'firebase/firestore';

const CUSTOMERS_COLLECTION = 'customers';

const customerFromDoc = (doc: QueryDocumentSnapshot<DocumentData>): Customer => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    dni: data.dni,
    email: data.email,
    phone: data.phone,
    totalPurchases: data.totalPurchases || 0,
    totalSpent: data.totalSpent || 0,
  };
};

// Subscribe to customers for a specific accountId only.
// Listening the entire collection without filtering may fail due to security rules
// if there are documents that don't belong to the caller's account.
export const getCustomers = (callback: (customers: Customer[]) => void, accountId?: string) => {
  if (!accountId) {
    console.warn('getCustomers: no accountId provided, returning empty list');
    callback([]);
    return () => {};
  }

  const q = query(collection(db, CUSTOMERS_COLLECTION), where('accountId', '==', accountId));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const customers = snapshot.docs.map(customerFromDoc);
    callback(customers);
  }, (err) => {
    console.error('onSnapshot error (customers query)', { errorCode: err && err.code, message: err && err.message });
  });
  return unsubscribe;
};

import { addDoc, doc, updateDoc } from 'firebase/firestore';

export const saveCustomer = async (customer: Partial<Customer> & { id?: string }) => {
  if (customer.id) {
    const customerRef = doc(db, CUSTOMERS_COLLECTION, customer.id);
    const { id, ...customerData } = customer;
  await updateDoc(customerRef, customerData as Partial<Customer>);
    return customer.id;
  } else {
    const { id, ...customerData } = customer;
  const docRef = await addDoc(collection(db, CUSTOMERS_COLLECTION), customerData as Partial<Customer>);
    return docRef.id;
  }
};
