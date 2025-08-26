import { db } from '@/lib/firebase';
import { Customer } from '@/types/customer';
import { collection, onSnapshot, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

const CUSTOMERS_COLLECTION = 'customers';

const customerFromDoc = (doc: QueryDocumentSnapshot<DocumentData>): Customer => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    totalPurchases: data.totalPurchases || 0,
    totalSpent: data.totalSpent || 0,
  };
};

export const getCustomers = (callback: (customers: Customer[]) => void) => {
  const customersCollection = collection(db, CUSTOMERS_COLLECTION);
  const unsubscribe = onSnapshot(customersCollection, (snapshot) => {
    const customers = snapshot.docs.map(customerFromDoc);
    callback(customers);
  });
  return unsubscribe;
};

import { addDoc, doc, updateDoc } from 'firebase/firestore';

export const saveCustomer = async (customer: Partial<Customer> & { id?: string }) => {
  if (customer.id) {
    const customerRef = doc(db, CUSTOMERS_COLLECTION, customer.id);
    const { id, ...customerData } = customer;
    await updateDoc(customerRef, customerData as any);
    return customer.id;
  } else {
    const { id, ...customerData } = customer;
    const docRef = await addDoc(collection(db, CUSTOMERS_COLLECTION), customerData as any);
    return docRef.id;
  }
};
