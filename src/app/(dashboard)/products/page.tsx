"use client"

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductModal } from '@/components/product-modal';
import type { Product } from '@/types/product';
import type { Branch } from '@/types/branch';
import { getProducts } from '@/services/product-service';
import { getBranches } from '@/services/branch-service';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all'); // 'all' para todas las sucursales
  const authState = useAuth();
  const { userRole } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const handleOpenModal = (product: Product | null) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  }

  const getTotalStock = (stock: Record<string, number>) => {
    return Object.values(stock).reduce((acc, val) => acc + val, 0);
  }

  const getBranchStock = (stock: Record<string, number>, branchId: string) => {
    return stock[branchId] || 0;
  }

  const getStockDisplay = (product: Product) => {
    if (selectedBranch === 'all') {
      return getTotalStock(product.stock);
    } else {
      return getBranchStock(product.stock, selectedBranch);
    }
  }

  const getStockLabel = () => {
    if (selectedBranch === 'all') {
      return 'Total';
    } else {
      const branch = branches.find(b => b.id === selectedBranch);
      return branch?.name || 'Sucursal';
    }
  }

  // Solo owner y admin pueden ver el selector de sucursales
  const canViewBranchSelector = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    const accountId = authState.userDoc?.accountId as string | undefined;
    const unsubscribe = getProducts(setProducts, accountId);
    return () => unsubscribe && unsubscribe();
  }, [authState.userDoc?.accountId]);

  // Cargar sucursales para owner y admin
  useEffect(() => {
    if (canViewBranchSelector && authState.userDoc?.accountId) {
      const accountId = authState.userDoc.accountId as string;
      const unsubscribe = getBranches(setBranches, accountId);
      return () => unsubscribe && unsubscribe();
    }
  }, [canViewBranchSelector, authState.userDoc?.accountId]);

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category).filter(Boolean));
    const arr = Array.from(set);
    if (!arr.includes('Todos')) arr.unshift('Todos');
    return arr;
  }, [products]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Productos</h1>
        <div className="flex items-center gap-4">
          {canViewBranchSelector && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Seleccionar sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sucursales</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }} onClick={() => handleOpenModal(null)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Producto
          </Button>
        </div>
      </div>

      <Tabs defaultValue="Todos" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-4">
      {categories.map(category => (
        <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
      ))}
    </TabsList>
        
    {categories.map(category => (
            <TabsContent key={category} value={category}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {(category === 'Todos' ? products : products.filter(p => p.category === category)).map(product => {
                        const stockAmount = getStockDisplay(product);
                        const stockLabel = getStockLabel();
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
                                        <div className="text-right">
                                          {stockAmount <= 10 ? (
                                              <Badge variant="destructive">Poco Stock</Badge>
                                          ) : (
                                              <Badge variant="outline">En Stock</Badge>
                                          )}
                                          <p className="text-xs text-muted-foreground mt-1">
                                            {stockLabel}: {stockAmount}
                                          </p>
                                        </div>
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
