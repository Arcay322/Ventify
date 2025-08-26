import { db } from '@/lib/firebase';
import { Product } from '@/types/product';
import { collection, getDocs, doc, setDoc, addDoc, onSnapshot, DocumentData, QueryDocumentSnapshot, updateDoc } from 'firebase/firestore';

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

export const getProducts = (callback: (products: Product[]) => void) => {
    const productsCollection = collection(db, PRODUCTS_COLLECTION);
    const unsubscribe = onSnapshot(productsCollection, (snapshot) => {
        const products = snapshot.docs.map(productFromDoc).sort((a, b) => a.name.localeCompare(b.name));
        callback(products);
    });
    return unsubscribe;
};

export const saveProduct = async (product: Partial<Product> & { id?: string }) => {
    if (product.id) {
        const productRef = doc(db, PRODUCTS_COLLECTION, product.id);
        const { id, ...productData } = product;
        await updateDoc(productRef, productData);
        return product.id;
    } else {
        const { id, ...productData } = product;
        const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), productData);
        return docRef.id;
    }
};
