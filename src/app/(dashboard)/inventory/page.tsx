"use client"

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Edit, Package, Plus, Search } from "lucide-react";
import { AdjustmentModal } from '@/components/adjustment-modal';
import type { Product } from '@/types/product';
import { getProductsAsync } from '@/services/product-service';
import { getBranchesAsync } from '@/services/branch-service';
import { useAuth } from '@/hooks/use-auth';

export default function InventoryPage() {
  const [inventoryItems, setInventoryItems] = useState<Product[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustmentMode, setAdjustmentMode] = useState<'add' | 'edit'>('edit');
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'low' | 'out'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const authState = useAuth();

  useEffect(() => {
    const loadData = async () => {
      if (!authState.userDoc?.accountId) {
        setLoading(false);
        return;
      }

      try {
        const accountId = authState.userDoc.accountId as string;
        console.log('🏪 Inventory: Loading data for account:', accountId);
        const [productsData, branchesData] = await Promise.all([
          getProductsAsync(accountId),
          getBranchesAsync(accountId)
        ]);
        console.log('📦 Inventory: Loaded', productsData.length, 'products,', branchesData.length, 'branches');
        setInventoryItems(productsData);
        setBranches(branchesData);
      } catch (error) {
        console.error('Error loading inventory data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authState.userDoc?.accountId]);

  const handleOpenAdjustmentModal = (product: Product) => {
    setSelectedProduct(product);
    setAdjustmentMode('edit');
    setIsAdjustmentModalOpen(true);
  }

  const handleOpenAddStockModal = (product: Product) => {
    setSelectedProduct(product);
    setAdjustmentMode('add');
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

  // Obtener categorías únicas
  const categories = Array.from(new Set(inventoryItems?.map(item => item.category).filter(Boolean) || []));

  // Función para filtrar productos
  const getFilteredItems = () => {
    if (!inventoryItems) return [];
    
    return inventoryItems.filter(item => {
      const totalStock = getTotalStock(item.stock || {});
      
      // Filtro por búsqueda (nombre, SKU, categoría)
      const matchesSearch = searchTerm === '' || 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Filtro por categoría
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      
      // Filtro por estado de stock
      let matchesStock = true;
      switch (stockFilter) {
        case 'out':
          matchesStock = totalStock === 0;
          break;
        case 'low':
          matchesStock = totalStock > 0 && totalStock <= 10;
          break;
        case 'in-stock':
          matchesStock = totalStock > 10;
          break;
        default:
          matchesStock = true;
      }
      
      return matchesSearch && matchesCategory && matchesStock;
    });
  };

  // Calcular estadísticas
  const totalProducts = inventoryItems?.length || 0;
  const outOfStock = inventoryItems?.filter(item => getTotalStock(item.stock || {}) === 0).length || 0;
  const lowStock = inventoryItems?.filter(item => {
    const stock = getTotalStock(item.stock || {});
    return stock > 0 && stock <= 10;
  }).length || 0;
  const totalInventoryValue = inventoryItems?.reduce((acc, item) => {
    const stock = getTotalStock(item.stock || {});
    return acc + (stock * (item.price || 0));
  }, 0) || 0;

  const filteredItems = getFilteredItems();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Inventario</h1>
          <p className="text-muted-foreground">Monitorea y ajusta el stock de productos por sucursal</p>
        </div>
        <Button variant="outline" asChild>
          <a href="/products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Ver Catálogo
          </a>
        </Button>
      </div>

      {!loading && inventoryItems.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay productos en tu inventario</h3>
              <p className="text-muted-foreground mb-4">
                Comienza agregando productos a tu catálogo para poder gestionar el inventario.
              </p>
              <Button asChild>
                <a href="/products" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Ir al Catálogo
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && inventoryItems.length > 0 && (
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
      ) : inventoryItems.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Stock Actual</CardTitle>
            <CardDescription>Un resumen de todos los productos en tu inventario por sucursal. Realiza ajustes o genera sugerencias de reorden.</CardDescription>
            
            {/* Barra de búsqueda y filtros */}
            <div className="mt-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar por nombre, SKU o categoría..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium whitespace-nowrap">Categoría:</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las categorías</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Estado:</label>
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
                  <div className="text-sm text-muted-foreground">
                    Mostrando {filteredItems.length} de {totalProducts} productos
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => exportCsv(inventoryItems || [])}>
                  Exportar CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  {(branches || []).map(branch => <TableHead key={branch.id} className="text-center">{branch.name}</TableHead>)}
                  <TableHead className="text-center">Stock Total</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={(branches?.length || 0) + 5} className="text-center py-8">
                      <div className="text-center">
                        <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground mb-2">
                          {searchTerm || categoryFilter !== 'all' || stockFilter !== 'all'
                            ? 'No hay productos que coincidan con los filtros aplicados'
                            : 'No hay productos en el inventario'
                          }
                        </p>
                        {(searchTerm || categoryFilter !== 'all' || stockFilter !== 'all') && (
                          <div className="text-xs text-muted-foreground space-y-1">
                            {searchTerm && <p>Búsqueda: "{searchTerm}"</p>}
                            {categoryFilter !== 'all' && <p>Categoría: {categoryFilter}</p>}
                            {stockFilter !== 'all' && <p>Estado: {
                              stockFilter === 'out' ? 'Agotados' : 
                              stockFilter === 'low' ? 'Stock bajo' : 'En stock'
                            }</p>}
                            <Button 
                              variant="link" 
                              size="sm" 
                              onClick={() => {
                                setSearchTerm('');
                                setCategoryFilter('all');
                                setStockFilter('all');
                              }}
                              className="mt-2"
                            >
                              Limpiar filtros
                            </Button>
                          </div>
                        )}
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
                        {(branches || []).map(branch => (
                          <TableCell key={branch.id} className="text-center">
                            {item.stock?.[branch.id] || 0}
                          </TableCell>
                        ))}
                        <TableCell className="font-bold text-center">{totalStock}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={status.variant}>{status.text}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleOpenAddStockModal(item)}
                              className="text-green-600 border-green-200 hover:bg-green-50"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Agregar
                            </Button>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              onClick={() => handleOpenAdjustmentModal(item)}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Ajustar Stock</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
      
      <AdjustmentModal 
        product={selectedProduct} 
        isOpen={isAdjustmentModalOpen} 
        onOpenChange={setIsAdjustmentModalOpen}
        mode={adjustmentMode}
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
