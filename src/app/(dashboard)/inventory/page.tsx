"use client"

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap, Edit } from "lucide-react";
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

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold tracking-tight">Gestión de Inventario</h1>

      <Card>
        <CardHeader>
          <CardTitle>Stock Actual</CardTitle>
          <CardDescription>Un resumen de todos los productos en tu inventario por sucursal. Realiza ajustes o genera sugerencias de reorden.</CardDescription>
          <div className="mt-2 flex items-center gap-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showLowStockOnly} onChange={(e) => setShowLowStockOnly(e.target.checked)} />
              <span className="text-sm">Mostrar solo bajo stock (≤10)</span>
            </label>
            <Button variant="ghost" size="sm" onClick={() => exportCsv(inventoryItems)} className="ml-auto">Exportar CSV</Button>
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
              {inventoryItems.filter(item => {
                const totalStock = getTotalStock(item.stock);
                return showLowStockOnly ? totalStock <= 10 : true;
              }).map((item) => {
                const totalStock = getTotalStock(item.stock);
                const status = getStatus(totalStock);
                const productForModal = item;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.sku}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    {branches.map(branch => <TableCell key={branch.id} className="text-center">{item.stock[branch.id] || 0}</TableCell>)}
                    <TableCell className="font-bold text-center">{totalStock}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={status.variant}>{status.text}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                       <Button variant="outline" size="icon" onClick={() => handleOpenAdjustmentModal(item)}>
                         <Edit className="h-4 w-4" />
                         <span className="sr-only">Ajustar Stock</span>
                       </Button>
                       <Button variant="outline" size="sm" onClick={() => handleOpenReorderModal(productForModal)} disabled={totalStock > 20}>
                         <Zap className="mr-2 h-4 w-4" />
                         Sugerir Reorden
                       </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <ReorderModal product={selectedProduct} isOpen={isReorderModalOpen} onOpenChange={setIsReorderModalOpen} />
      <AdjustmentModal product={selectedProduct} isOpen={isAdjustmentModalOpen} onOpenChange={setIsAdjustmentModalOpen} />
    </div>
  )
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

// Subscriptions are handled inside the component lifecycle above.
