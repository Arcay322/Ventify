import { db } from '@/lib/firebase';
import { Product } from '@/types/product';
import { collection, getDocs, doc, setDoc, addDoc, onSnapshot, DocumentData, QueryDocumentSnapshot, QuerySnapshot, query, where } from 'firebase/firestore';

const PRODUCTS_COLLECTION = 'products';

const productFromDoc = (doc: QueryDocumentSnapshot<DocumentData>): Product => {
    const data = doc.data();
    return {
        id: doc.id,
        name: data.name,
        category: data.category,
        price: data.price,
    stock: data.stock || {},
    costPrice: data.costPrice || 0,
    sku: data.sku || '',
        imageUrl: data.imageUrl,
        hint: data.hint,
        supplier: data.supplier,
    };
}

export const getProducts = (callback: (products: Product[]) => void, accountId?: string) => {
    const productsCollection = collection(db, PRODUCTS_COLLECTION);
    const q = accountId ? query(productsCollection, where('accountId', '==', accountId)) : productsCollection;
        const unsubscribe = onSnapshot(q as any, (snapshot: QuerySnapshot<DocumentData>) => {
        const products = snapshot.docs.map(productFromDoc).sort((a: Product, b: Product) => a.name.localeCompare(b.name));
        callback(products);
        }, (err) => {
            console.error('onSnapshot error (products query)', { errorCode: err && err.code, message: err && err.message });
        });
    return unsubscribe;
};

export const saveProduct = async (product: Partial<Product> & { id?: string }) => {
    if (product.id) {
        const productRef = doc(db, PRODUCTS_COLLECTION, product.id);
        const { id, ...productData } = product;
    // Use setDoc with merge to create-or-update; ensures productData.accountId gets written when present
    await setDoc(productRef, productData as any, { merge: true });
        return product.id;
    } else {
        const { id, ...productData } = product;
    // Ensure accountId is included when creating
        const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), productData);
        return docRef.id;
    }
};
