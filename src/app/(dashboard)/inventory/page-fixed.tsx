"use client"

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap, Edit, Package } from "lucide-react";
import { ReorderModal } from '@/components/reorder-modal';
import { AdjustmentModal } from '@/components/adjustment-modal';
import type { Product } from '@/types/product';
import { getProducts } from '@/services/product-service';
import { getBranches } from '@/services/branch-service';

export default function InventoryPage() {
  const [inventoryItems, setInventoryItems] = useState<Product[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'low' | 'out'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsData, branchesData] = await Promise.all([
          getProducts(),
          getBranches()
        ]);
        setInventoryItems(productsData);
        setBranches(branchesData);
      } catch (error) {
        console.error('Error loading inventory data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleOpenReorderModal = (product: Product) => {
    setSelectedProduct(product);
    setIsReorderModalOpen(true);
  }

  const handleOpenAdjustmentModal = (product: Product) => {
    setSelectedProduct(product);
    setIsAdjustmentModalOpen(true);
  }

  const getTotalStock = (stock: Record<string, number>) => {
    return Object.values(stock).reduce((acc, val) => acc + val, 0);
  }

  const getStatus = (totalStock: number) => {
    if (totalStock === 0) return { text: 'Agotado', variant: 'destructive' as const };
    if (totalStock <= 10) return { text: 'Poco Stock', variant: 'destructive' as const };
    if (totalStock <= 20) return { text: 'Bajo', variant: 'secondary' as const };
    return { text: 'En Stock', variant: 'outline' as const};
  }

  // Filtrado mejorado
  const getFilteredItems = () => {
    return inventoryItems.filter(item => {
      const totalStock = getTotalStock(item.stock || {});
      
      switch (stockFilter) {
        case 'out':
          return totalStock === 0;
        case 'low':
          return totalStock > 0 && totalStock <= 10;
        case 'in-stock':
          return totalStock > 10;
        default:
          return showLowStockOnly ? totalStock <= 10 : true;
      }
    });
  };

  // Calcular estadísticas
  const totalProducts = inventoryItems.length;
  const outOfStock = inventoryItems.filter(item => getTotalStock(item.stock || {}) === 0).length;
  const lowStock = inventoryItems.filter(item => {
    const stock = getTotalStock(item.stock || {});
    return stock > 0 && stock <= 10;
  }).length;
  const totalInventoryValue = inventoryItems.reduce((acc, item) => {
    const stock = getTotalStock(item.stock || {});
    return acc + (stock * (item.price || 0));
  }, 0);

  const filteredItems = getFilteredItems();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Inventario</h1>
          <p className="text-muted-foreground">Monitorea y ajusta el stock de productos por sucursal</p>
        </div>
        <Button variant="outline" asChild>
          <a href="/dashboard/products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Ver Catálogo
          </a>
        </Button>
      </div>

      {!loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProducts}</div>
              <p className="text-xs text-muted-foreground">productos en catálogo</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sin Stock</CardTitle>
              <Badge variant="destructive" className="h-4 w-4 p-0"></Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{outOfStock}</div>
              <p className="text-xs text-muted-foreground">productos agotados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
              <Badge variant="secondary" className="h-4 w-4 p-0"></Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{lowStock}</div>
              <p className="text-xs text-muted-foreground">productos con poco stock</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Inventario</CardTitle>
              <span className="h-4 w-4 text-muted-foreground">$</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalInventoryValue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">valor total estimado</p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Cargando inventario...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Stock Actual</CardTitle>
            <CardDescription>Un resumen de todos los productos en tu inventario por sucursal. Realiza ajustes o genera sugerencias de reorden.</CardDescription>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="stock-filter" className="text-sm font-medium">Filtrar por:</label>
                <Select value={stockFilter} onValueChange={(value: 'all' | 'in-stock' | 'low' | 'out') => setStockFilter(value)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="in-stock">En Stock</SelectItem>
                    <SelectItem value="low">Stock Bajo</SelectItem>
                    <SelectItem value="out">Agotados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="sm" onClick={() => exportCsv(inventoryItems)} className="ml-auto">
                Exportar CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  {branches.map(branch => <TableHead key={branch.id} className="text-center">{branch.name}</TableHead>)}
                  <TableHead className="text-center">Stock Total</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={branches.length + 5} className="text-center py-8">
                      <div className="text-center">
                        <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">
                          {stockFilter === 'all' 
                            ? 'No hay productos en el inventario' 
                            : `No hay productos ${stockFilter === 'out' ? 'agotados' : stockFilter === 'low' ? 'con stock bajo' : 'en stock'}`
                          }
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const totalStock = getTotalStock(item.stock || {});
                    const status = getStatus(totalStock);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.sku}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        {branches.map(branch => (
                          <TableCell key={branch.id} className="text-center">
                            {item.stock?.[branch.id] || 0}
                          </TableCell>
                        ))}
                        <TableCell className="font-bold text-center">{totalStock}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={status.variant}>{status.text}</Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="icon" onClick={() => handleOpenAdjustmentModal(item)}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Ajustar Stock</span>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleOpenReorderModal(item)} 
                            disabled={totalStock > 20}
                          >
                            <Zap className="mr-2 h-4 w-4" />
                            Sugerir Reorden
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      <ReorderModal 
        product={selectedProduct} 
        isOpen={isReorderModalOpen} 
        onOpenChange={setIsReorderModalOpen} 
      />
      <AdjustmentModal 
        product={selectedProduct} 
        isOpen={isAdjustmentModalOpen} 
        onOpenChange={setIsAdjustmentModalOpen} 
      />
    </div>
  );
}

function exportCsv(items: Product[]) {
  const header = ['sku','name','category','totalStock','stockByBranch'];
  const rows = items.map(it => {
    const total = Object.values(it.stock || {}).reduce((a,b) => a + b, 0);
    const byBranch = Object.entries(it.stock || {}).map(([k,v]) => `${k}:${v}`).join(';');
    return [it.sku, it.name, it.category, String(total), byBranch];
  });
  const csv = [header, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventory-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
