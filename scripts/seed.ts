import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from '../src/lib/firebase';
import { mockBranches, mockProducts, mockCustomers } from '../src/lib/mock-data';
import { setDoc, doc } from 'firebase/firestore';

async function seed() {
  console.log('Seeding Firestore with mock data...');

  // Branches
  for (const b of mockBranches) {
    try {
      await setDoc(doc(db, 'branches', b.id), b as any);
      console.log(`Branch seeded: ${b.id}`);
    } catch (err) {
      console.error('Error seeding branch', b.id, err);
    }
  }

  // Products
  for (const p of mockProducts) {
    try {
      // Ensure product stock references existing branch IDs in mockBranches
      await setDoc(doc(db, 'products', p.id), p as any);
      console.log(`Product seeded: ${p.id}`);
    } catch (err) {
      console.error('Error seeding product', p.id, err);
    }
  }

  // Customers
  for (const c of mockCustomers) {
    try {
      await setDoc(doc(db, 'customers', c.id), c as any);
      console.log(`Customer seeded: ${c.id}`);
    } catch (err) {
      console.error('Error seeding customer', c.id, err);
    }
  }

  console.log('Seeding complete.');
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
