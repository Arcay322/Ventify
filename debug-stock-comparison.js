// Debug script to compare stock values across different methods
// Run this in the browser console

console.log('🔍 Starting stock comparison debug...');

const checkProductStock = async () => {
  try {
    // Get the userDoc to get accountId
    const userDocElement = document.querySelector('[data-user-doc]');
    const accountId = userDocElement?.getAttribute('data-account-id');
    
    if (!accountId) {
      console.log('❌ No accountId found, using null');
    }
    
    console.log(`📋 Using accountId: ${accountId}`);
    
    // Method 1: Use ProductService.getProductsAsync
    console.log('\n📦 Method 1: ProductService.getProductsAsync');
    const asyncProducts = await ProductService.getProductsAsync(accountId);
    const sillaAsync = asyncProducts.find(p => p.name === 'Silla');
    console.log('Silla stock (async):', sillaAsync?.stock);
    
    // Method 2: Direct Firestore query
    console.log('\n📦 Method 2: Direct Firestore query');
    const productsRef = firebase.firestore().collection('products');
    const query = accountId ? productsRef.where('accountId', '==', accountId) : productsRef;
    const snapshot = await query.get();
    
    let sillaFirestore = null;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.name === 'Silla') {
        sillaFirestore = {
          id: doc.id,
          ...data,
          stock: data.stock || {}
        };
      }
    });
    
    console.log('Silla stock (direct firestore):', sillaFirestore?.stock);
    
    // Method 3: Check what's in React state (if available)
    console.log('\n📦 Method 3: Current React state');
    const reactProducts = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.values()?.next()?.value?.findFiberByHostInstance?.(document.body)?.memoizedProps?.products;
    if (reactProducts) {
      const sillaReact = reactProducts.find(p => p.name === 'Silla');
      console.log('Silla stock (react state):', sillaReact?.stock);
    } else {
      console.log('React products not accessible through devtools');
    }
    
  } catch (error) {
    console.error('Error in stock comparison:', error);
  }
};

checkProductStock();
