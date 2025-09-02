import { db } from '@/lib/firebase';
import { Product } from '@/types/product';
import { collection, getDocs, doc, setDoc, addDoc, onSnapshot, DocumentData, QueryDocumentSnapshot, QuerySnapshot, query, where } from 'firebase/firestore';

const PRODUCTS_COLLECTION = 'products';

const productFromDoc = (doc: QueryDocumentSnapshot<DocumentData>): Product => {
    const data = doc.data();
    const product = {
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
        accountId: data.accountId, // Incluir accountId
    };
    
    // Debug log for Silla product
    if (data.name === 'Silla') {
        console.log(`📦 Product 'Silla' loaded from Firestore:`, {
            id: product.id,
            stock: product.stock,
            accountId: product.accountId,
            fromFunction: 'productFromDoc'
        });
    }
    
    return product;
}

export const getProducts = (callback: (products: Product[]) => void, accountId?: string) => {
    const productsCollection = collection(db, PRODUCTS_COLLECTION);
    
    // Filtrar por accountId solo si está disponible, sino mostrar todos (para compatibilidad)
    const q = accountId ? query(productsCollection, where('accountId', '==', accountId)) : productsCollection;
    
    const unsubscribe = onSnapshot(q as any, (snapshot: QuerySnapshot<DocumentData>) => {
        let products = snapshot.docs.map(productFromDoc).sort((a: Product, b: Product) => a.name.localeCompare(b.name));
        
        // Debug log
        const silla = products.find(p => p.name === 'Silla');
        if (silla) {
            console.log(`🔄 getProducts (onSnapshot) - Silla stock:`, silla.stock);
        }
        
        callback(products);
    }, (err) => {
        console.error('onSnapshot error (products query)', { errorCode: err && err.code, message: err && err.message });
        
        // Si hay error con el filtro, intentar sin filtro
        if (accountId && err.code === 'permission-denied') {
            console.log('📦 Permission denied with accountId filter, trying without filter');
            const fallbackQ = productsCollection;
            return onSnapshot(fallbackQ as any, (snapshot: QuerySnapshot<DocumentData>) => {
                const products = snapshot.docs.map(productFromDoc).sort((a: Product, b: Product) => a.name.localeCompare(b.name));
                callback(products);
            });
        }
    });
    return unsubscribe;
};

export const saveProduct = async (product: Partial<Product> & { id?: string; accountId?: string }) => {
    // Asegurarse de que accountId esté incluido en los datos
    if (!product.accountId) {
        throw new Error('accountId es requerido para guardar el producto');
    }
    
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

// Promise-based version for easier async/await usage
export const getProductsAsync = async (accountId?: string): Promise<Product[]> => {
  const productsCollection = collection(db, PRODUCTS_COLLECTION);
  const q = accountId ? query(productsCollection, where('accountId', '==', accountId)) : productsCollection;
  const snapshot = await getDocs(q);
  const products = snapshot.docs.map(productFromDoc);
  
  // Debug log
  const silla = products.find(p => p.name === 'Silla');
  if (silla) {
      console.log(`📋 getProductsAsync - Silla stock:`, silla.stock);
  }
  
  return products;
};

// Export as a service object for cleaner imports
export const ProductService = {
  getProducts,
  getProductsAsync,
  saveProduct
};
