"use client"

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';

export function DebugProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const authState = useAuth();

  const fetchAllProducts = async () => {
    setLoading(true);
    try {
      const productsCollection = collection(db, 'products');
      const snapshot = await getDocs(productsCollection);
      const allProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(allProducts);
      console.log('🐛 All products from DB:', allProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fixProductsAccountId = async () => {
    if (!authState.userDoc?.accountId) {
      alert('No se puede determinar el accountId del usuario');
      return;
    }

    setLoading(true);
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const accountId = authState.userDoc.accountId;
      
      for (const product of products) {
        if (!product.accountId) {
          console.log(`Actualizando producto ${product.name} con accountId: ${accountId}`);
          const productRef = doc(db, 'products', product.id);
          await updateDoc(productRef, { accountId });
        }
      }
      
      alert('Productos actualizados con accountId');
      await fetchAllProducts(); // Recargar
    } catch (error) {
      console.error('Error updating products:', error);
      alert('Error al actualizar productos: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>🐛 Debug: Productos en Base de Datos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Usuario Actual:</strong><br/>
            UID: {authState.uid}<br/>
            Email: {authState.user?.email}<br/>
            Role: {authState.userDoc?.role}<br/>
            AccountId: {authState.userDoc?.accountId}<br/>
            BranchId: {authState.userDoc?.branchId}<br/>
            Initialized: {authState.initialized ? 'Sí' : 'No'}
          </div>
          <div>
            <strong>Productos Encontrados:</strong><br/>
            Total: {products.length}<br/>
            <div className="space-y-2">
              <Button onClick={fetchAllProducts} disabled={loading}>
                {loading ? 'Cargando...' : 'Cargar Productos'}
              </Button>
              {products.some(p => !p.accountId) && (
                <Button onClick={fixProductsAccountId} disabled={loading} variant="destructive">
                  Arreglar AccountId
                </Button>
              )}
            </div>
          </div>
        </div>

        {products.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Productos en DB:</h3>
            <div className="max-h-96 overflow-y-auto">
              {products.map((product, index) => (
                <div key={product.id} className="p-3 border rounded-lg bg-gray-50">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><strong>ID:</strong> {product.id}</div>
                    <div><strong>Nombre:</strong> {product.name}</div>
                    <div><strong>Precio:</strong> S/{product.price}</div>
                    <div><strong>SKU:</strong> {product.sku}</div>
                    <div><strong>AccountId:</strong> {product.accountId || 'NO DEFINIDO'}</div>
                    <div><strong>Stock:</strong> {JSON.stringify(product.stock || {})}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}