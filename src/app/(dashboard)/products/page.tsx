"use client"

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductModal } from '@/components/product-modal';
import type { Product } from '@/types/product';
import { getProducts } from '@/services/product-service';
import { useAuth } from '@/hooks/use-auth';
import { mockCategories } from '@/lib/mock-data';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const authState = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const handleOpenModal = (product: Product | null) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  }

  const getTotalStock = (stock: Record<string, number>) => {
    return Object.values(stock).reduce((acc, val) => acc + val, 0);
  }

  useEffect(() => {
  const accountId = authState.userDoc?.accountId as string | undefined;
  const unsubscribe = getProducts(setProducts, accountId);
    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Productos</h1>
        <Button style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }} onClick={() => handleOpenModal(null)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Agregar Producto
        </Button>
      </div>

      <Tabs defaultValue="Todos" className="w-full">
    <TabsList className="grid w-full grid-cols-4 mb-4">
      {(mockCategories.length ? mockCategories : Array.from(new Set(products.map(p => p.category))).concat(['Todos'])).map(category => (
        <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
      ))}
    </TabsList>
        
    {(mockCategories.length ? mockCategories : Array.from(new Set(products.map(p => p.category))).concat(['Todos'])).map(category => (
            <TabsContent key={category} value={category}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {(category === 'Todos' ? products : products.filter(p => p.category === category)).map(product => {
                        const totalStock = getTotalStock(product.stock);
                        return (
                            <Card key={product.id} className="overflow-hidden flex flex-col">
                                <CardHeader className="p-0">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      width={400}
                      height={300}
                      data-ai-hint={product.hint}
                      className="object-cover w-full h-40"
                    />
                  ) : (
                    <div className="w-full h-40 bg-muted/40 flex items-center justify-center">No Image</div>
                  )}
                                </CardHeader>
                                <CardContent className="p-4 flex-grow">
                                    <h3 className="text-lg font-semibold">{product.name}</h3>
                                    <p className="text-sm text-muted-foreground">{product.category}</p>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-xl font-bold">S/{product.price.toFixed(2)}</span>
                                        {totalStock <= 10 ? (
                                            <Badge variant="destructive">Poco Stock ({totalStock})</Badge>
                                        ) : (
                                            <Badge variant="outline">En Stock ({totalStock})</Badge>
                                        )}
                                    </div>
                                </CardContent>
                                <CardFooter className="p-4 pt-0">
                                    <Button className="w-full" variant="outline" onClick={() => handleOpenModal(product)}>Editar Producto</Button>
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            </TabsContent>
        ))}
      </Tabs>
      <ProductModal 
        product={selectedProduct} 
        isOpen={isModalOpen} 
        onOpenChange={setIsModalOpen}
      />
    </div>
  )
}
