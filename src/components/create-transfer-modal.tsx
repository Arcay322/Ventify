"use client"

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { BranchService } from '@/services/branch-service';
import { ProductService } from '@/services/product-service';
import { TransferService } from '@/services/transfer-service';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { StockReservationService } from '@/services/stock-reservation-service';
import type { Branch } from '@/types/branch';
import type { Product } from '@/types/product';
import type { TransferRequest } from '@/types/transfer';
import { Plus, Minus, Package } from 'lucide-react';

interface CreateTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferCreated: () => void;
}

interface TransferProduct {
  productId: string;
  quantity: number;
  name: string;
  sku: string;
  category: string;
  availableStock: number;
}

export function CreateTransferModal({ 
  open, 
  onOpenChange, 
  onTransferCreated 
}: CreateTransferModalProps) {
  const { userDoc, user, initialized } = useAuth();
  const { toast } = useToast();
  const { 
    canRequestTransferFromBranch, 
    canCreateDirectTransfer, 
    userBranchId, 
    userRole 
  } = usePermissions();
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sourceBranchId, setSourceBranchId] = useState<string>('');
  const [destinationBranchId, setDestinationBranchId] = useState<string>('');
  const [selectedProducts, setSelectedProducts] = useState<TransferProduct[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Load branches and products on mount
  useEffect(() => {
    const loadData = async () => {
      if (!userDoc?.accountId) {
        return;
      }

      try {
        const [branchesData, productsData] = await Promise.all([
          BranchService.getBranchesAsync(userDoc.accountId),
          ProductService.getProductsAsync(userDoc.accountId)
        ]);
        setBranches(branchesData);
        setProducts(productsData);
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: "Error",
          description: "Error al cargar sucursales y productos",
          variant: "destructive",
        });
      }
    };

    if (open) {
      loadData();
    }
  }, [open, userDoc?.accountId, toast]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSourceBranchId('');
      setDestinationBranchId('');
      setSelectedProducts([]);
      setNotes('');
    }
  }, [open]);

  const handleAddProduct = () => {
    setSelectedProducts(prev => [...prev, {
      productId: '',
      quantity: 1,
      name: '',
      sku: '',
      category: '',
      availableStock: 0
    }]);
  };

  const handleRemoveProduct = (index: number) => {
    setSelectedProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const availableStock = sourceBranchId ? StockReservationService.getAvailableStock(product, sourceBranchId) : 0;

    setSelectedProducts(prev => prev.map((item, i) => 
      i === index ? {
        ...item,
        productId,
        name: product.name,
        sku: product.sku || '',
        category: product.category || '',
        availableStock,
        quantity: Math.min(item.quantity, availableStock)
      } : item
    ));
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    setSelectedProducts(prev => prev.map((item, i) => 
      i === index ? {
        ...item,
        quantity: Math.max(0, Math.min(quantity, item.availableStock))
      } : item
    ));
  };

  // Update available stock when source branch changes
  useEffect(() => {
    if (sourceBranchId && selectedProducts.length > 0) {
      setSelectedProducts(prev => prev.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return item;

        const availableStock = product.stock[sourceBranchId] ? StockReservationService.getAvailableStock(product, sourceBranchId) : 0;
        return {
          ...item,
          availableStock,
          quantity: Math.min(item.quantity, availableStock)
        };
      }));
    }
  }, [sourceBranchId, products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userDoc?.accountId || !user?.uid) {
      toast({
        title: "Error",
        description: "Usuario no autenticado",
        variant: "destructive",
      });
      return;
    }

    // Validation
    if (!sourceBranchId) {
      toast({
        title: "Error",
        description: "Selecciona la sucursal de origen",
        variant: "destructive",
      });
      return;
    }

    if (!destinationBranchId) {
      toast({
        title: "Error",
        description: "Selecciona la sucursal de destino",
        variant: "destructive",
      });
      return;
    }

    if (sourceBranchId === destinationBranchId) {
      toast({
        title: "Error",
        description: "La sucursal de origen y destino deben ser diferentes",
        variant: "destructive",
      });
      return;
    }

    if (selectedProducts.length === 0) {
      toast({
        title: "Error",
        description: "Agrega al menos un producto",
        variant: "destructive",
      });
      return;
    }

    const invalidProducts = selectedProducts.filter(p => 
      !p.productId || p.quantity <= 0 || p.quantity > p.availableStock
    );

    if (invalidProducts.length > 0) {
      toast({
        title: "Error",
        description: "Verifica las cantidades de los productos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const transferRequest: TransferRequest = {
        accountId: userDoc.accountId,
        sourceBranchId,
        destinationBranchId,
        products: selectedProducts.map(p => ({
          productId: p.productId,
          quantity: p.quantity,
          name: p.name,
          sku: p.sku,
          category: p.category
        })),
        notes: notes.trim() || undefined,
        requestedBy: user.uid
      };

      await TransferService.createTransfer(transferRequest);

      toast({
        title: "¡Éxito!",
        description: "Transferencia creada correctamente",
      });

      onTransferCreated();
      onOpenChange(false);

    } catch (error) {
      console.error('Error creating transfer:', error);
      toast({
        title: "Error",
        description: "Error al crear la transferencia",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sourceBranch = branches.find(b => b.id === sourceBranchId);
  const destinationBranch = branches.find(b => b.id === destinationBranchId);
  const availableProducts = products.filter(p => 
    sourceBranchId && StockReservationService.getAvailableStock(p, sourceBranchId) > 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {canCreateDirectTransfer() ? 'Crear Nueva Transferencia' : 'Solicitar Transferencia'}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            {canCreateDirectTransfer() ? (
              'Como administrador, puedes crear transferencias directas entre cualquier sucursal.'
            ) : userRole === 'manager' ? (
              'Como gerente, puedes solicitar transferencias desde tu sucursal.'
            ) : (
              'Como cajero, puedes solicitar transferencias desde tu sucursal.'
            )}
          </div>
        </DialogHeader>

        {!initialized || !userDoc ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Cargando información del usuario...</span>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Branch Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sourceBranch">Sucursal de Origen</Label>
              <Select
                value={sourceBranchId}
                onValueChange={setSourceBranchId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona sucursal origen" />
                </SelectTrigger>
                <SelectContent>
                  {branches
                    .filter(branch => canRequestTransferFromBranch(branch.id))
                    .map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="destinationBranch">Sucursal de Destino</Label>
              <Select
                value={destinationBranchId}
                onValueChange={setDestinationBranchId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona sucursal destino" />
                </SelectTrigger>
                <SelectContent>
                  {branches
                    .filter(branch => branch.id !== sourceBranchId)
                    .map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Product Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Productos a Transferir</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddProduct}
                disabled={!sourceBranchId || availableProducts.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Producto
              </Button>
            </div>

            {selectedProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay productos seleccionados</p>
                <p className="text-sm">
                  {!sourceBranchId 
                    ? "Selecciona una sucursal de origen primero"
                    : "Haz clic en 'Agregar Producto' para comenzar"
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedProducts.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <Select
                        value={item.productId}
                        onValueChange={(value) => handleProductChange(index, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProducts
                            .filter(p => !selectedProducts.some((sp, i) => i !== index && sp.productId === p.id))
                            .map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                <div>
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-sm text-gray-500">
                                    SKU: {product.sku} | Stock Disponible: {sourceBranchId ? StockReservationService.getAvailableStock(product, sourceBranchId) : 0}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-32">
                      <Input
                        type="number"
                        min="1"
                        max={item.availableStock}
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                        placeholder="Cantidad"
                      />
                      {item.productId && (
                        <div className="text-xs text-gray-500 mt-1">
                          Max: {item.availableStock}
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveProduct(index)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notas (Opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Añade cualquier observación sobre esta transferencia..."
              className="mt-1"
            />
          </div>

          {/* Summary */}
          {(sourceBranch || destinationBranch || selectedProducts.length > 0) && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <h4 className="font-medium">Resumen de Transferencia</h4>
              {sourceBranch && (
                <p className="text-sm">
                  <span className="font-medium">Origen:</span> {sourceBranch.name}
                </p>
              )}
              {destinationBranch && (
                <p className="text-sm">
                  <span className="font-medium">Destino:</span> {destinationBranch.name}
                </p>
              )}
              {selectedProducts.length > 0 && (
                <p className="text-sm">
                  <span className="font-medium">Productos:</span> {selectedProducts.length}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || selectedProducts.length === 0}
            >
              {loading ? "Creando..." : "Crear Transferencia"}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}