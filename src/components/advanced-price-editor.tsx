"use client"

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit3, Gift, Percent, Users } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';

interface PriceTier {
  minQuantity: number;
  price: number;
  label: string;
}

interface AdvancedPriceEditorProps {
  productName: string;
  originalPrice: number;
  currentPrice: number;
  quantity: number;
  onPriceChange: (newPrice: number, reason?: string) => void;
  onQuantityChange?: (newQuantity: number) => void;
  disabled?: boolean;
  trigger?: React.ReactNode;
}

export function AdvancedPriceEditor({ 
  productName, 
  originalPrice, 
  currentPrice, 
  quantity,
  onPriceChange,
  onQuantityChange,
  disabled = false,
  trigger 
}: AdvancedPriceEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newPrice, setNewPrice] = useState(currentPrice.toString());
  const [discountReason, setDiscountReason] = useState('');
  const [activeTab, setActiveTab] = useState('manual');
  const { toast } = useToast();
  const { canModifyPrice } = usePermissions();

  // Precios por mayor predefinidos (se pueden configurar por producto)
  const wholesaleTiers: PriceTier[] = [
    { minQuantity: 1, price: originalPrice, label: 'Precio Normal' },
    { minQuantity: 5, price: originalPrice * 0.95, label: '5+ unidades (-5%)' },
    { minQuantity: 10, price: originalPrice * 0.90, label: '10+ unidades (-10%)' },
    { minQuantity: 20, price: originalPrice * 0.85, label: '20+ unidades (-15%)' },
    { minQuantity: 50, price: originalPrice * 0.80, label: '50+ unidades (-20%)' },
  ];

  // Descuentos rápidos predefinidos (adaptados al contexto peruano)
  const quickDiscounts = [
    { percentage: 5, label: '5% - Regateo ligero' },
    { percentage: 10, label: '10% - Cliente frecuente' },
    { percentage: 15, label: '15% - Regateo fuerte' },
    { percentage: 20, label: '20% - Mayorista' },
    { percentage: 25, label: '25% - Liquidación' },
    { percentage: 30, label: '30% - Oferta especial' },
  ];

  const getWholesalePrice = () => {
    const applicableTier = wholesaleTiers
      .filter(tier => quantity >= tier.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0];
    
    return applicableTier || wholesaleTiers[0];
  };

  const handleSavePrice = (price: number, reason: string = '') => {
    if (isNaN(price) || price < 0) {
      toast({ 
        title: 'Precio inválido', 
        description: 'Ingresa un precio válido mayor o igual a 0', 
        variant: 'destructive' 
      });
      return;
    }

    // Permitir precios de regalo (S/0.00)
    if (price === 0 && !reason.includes('Regalo')) {
      reason = reason || 'Producto de regalo';
    }

    onPriceChange(price, reason);
    setIsOpen(false);
    
    if (price !== originalPrice) {
      const changeType = price === 0 ? 'Regalo' : price < originalPrice ? 'Descuento' : 'Incremento';
      toast({ 
        title: `${changeType} aplicado`, 
        description: `${productName}: S/${originalPrice.toFixed(2)} → S/${price.toFixed(2)}${reason ? ` (${reason})` : ''}` 
      });
    }
  };

  const applyWholesalePrice = () => {
    const tier = getWholesalePrice();
    handleSavePrice(tier.price, `Precio por mayor - ${tier.label}`);
  };

  const applyQuickDiscount = (percentage: number, label: string) => {
    const discountedPrice = originalPrice * (1 - percentage / 100);
    handleSavePrice(discountedPrice, label);
  };

  const applyGift = () => {
    handleSavePrice(0, 'Producto de regalo');
  };

  const handleOpenDialog = () => {
    if (!canModifyPrice()) {
      toast({ 
        title: 'Sin permisos', 
        description: 'No tienes permisos para modificar precios', 
        variant: 'destructive' 
      });
      return;
    }
    setNewPrice(currentPrice.toString());
    setDiscountReason('');
    setIsOpen(true);
  };

  if (disabled || !canModifyPrice()) {
    return null;
  }

  const currentTier = getWholesalePrice();
  const hasWholesaleDiscount = currentTier.minQuantity > 1;

  return (
    <>
      <div className="flex items-center gap-1">
        {trigger ? (
          React.cloneElement(trigger as React.ReactElement, {
            onClick: handleOpenDialog
          })
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleOpenDialog}
            title="Modificar precio"
          >
            <Edit3 className="h-3 w-3" />
          </Button>
        )}
        
        {hasWholesaleDiscount && (
          <Badge variant="secondary" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            Mayor
          </Badge>
        )}
        
        {currentPrice === 0 && (
          <Badge variant="outline" className="text-xs text-green-600">
            <Gift className="h-3 w-3 mr-1" />
            Regalo
          </Badge>
        )}
        
        {currentPrice < originalPrice && currentPrice > 0 && (
          <Badge variant="outline" className="text-xs text-blue-600">
            <Percent className="h-3 w-3 mr-1" />
            {Math.round(((originalPrice - currentPrice) / originalPrice) * 100)}%
          </Badge>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajustar Precio - {productName}</DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="bargain">Regateo</TabsTrigger>
              <TabsTrigger value="wholesale">Por Mayor</TabsTrigger>
              <TabsTrigger value="discounts">Descuentos</TabsTrigger>
              <TabsTrigger value="gift">Regalo</TabsTrigger>
            </TabsList>

            <TabsContent value="bargain" className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <h3 className="font-semibold text-orange-800 mb-2">🤝 Regateo Rápido</h3>
                  <p className="text-sm text-orange-700 mb-3">
                    Opciones comunes para negociación con clientes
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { amount: 1, label: 'S/1 menos' },
                      { amount: 2, label: 'S/2 menos' },
                      { amount: 5, label: 'S/5 menos' },
                      { amount: 10, label: 'S/10 menos' },
                    ].map((option) => {
                      const newPrice = Math.max(0, originalPrice - option.amount);
                      return (
                        <Button
                          key={option.amount}
                          variant="outline"
                          className="h-auto p-3 flex flex-col items-center"
                          onClick={() => handleSavePrice(newPrice, `Regateo: ${option.label}`)}
                        >
                          <span className="font-semibold">{option.label}</span>
                          <span className="text-xs text-muted-foreground">
                            S/{newPrice.toFixed(2)}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descuentos por Porcentaje</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[5, 10, 15, 20, 25, 30].map((percentage) => {
                      const discountedPrice = originalPrice * (1 - percentage / 100);
                      return (
                        <Button
                          key={percentage}
                          variant="outline"
                          className="h-auto p-3 flex flex-col items-center"
                          onClick={() => handleSavePrice(discountedPrice, `Regateo: -${percentage}%`)}
                        >
                          <span className="font-semibold">-{percentage}%</span>
                          <span className="text-xs text-muted-foreground">
                            S/{discountedPrice.toFixed(2)}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Precio original:</span>
                      <span className="font-medium">S/{originalPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Precio actual:</span>
                      <span className="font-medium text-primary">S/{currentPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cantidad:</span>
                      <span className="font-medium">{quantity}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total línea:</span>
                      <span>S/{(currentPrice * quantity).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-sm">Precio Original</Label>
                  <div className="text-lg font-semibold">S/{originalPrice.toFixed(2)}</div>
                </div>
                <div>
                  <Label className="text-sm">Precio Actual</Label>
                  <div className="text-lg font-semibold text-primary">S/{currentPrice.toFixed(2)}</div>
                </div>
                <div>
                  <Label className="text-sm">Cantidad</Label>
                  <div className="text-lg font-semibold">{quantity}</div>
                </div>
              </div>

              <div>
                <Label htmlFor="newPrice">Nuevo Precio</Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">S/</span>
                  <Input
                    id="newPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="reason">Motivo del cambio (opcional)</Label>
                <Input
                  id="reason"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Ej: Regateo, cliente frecuente, promoción..."
                />
              </div>

              {parseFloat(newPrice) !== originalPrice && !isNaN(parseFloat(newPrice)) && (
                <div className="p-3 bg-muted rounded-md">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Diferencia:</span>
                      <span className={parseFloat(newPrice) > originalPrice ? 'text-green-600' : 'text-red-600'}>
                        {parseFloat(newPrice) > originalPrice ? '+' : ''}
                        S/{(parseFloat(newPrice) - originalPrice).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Porcentaje:</span>
                      <span className={parseFloat(newPrice) > originalPrice ? 'text-green-600' : 'text-red-600'}>
                        {parseFloat(newPrice) > originalPrice ? '+' : ''}
                        {(((parseFloat(newPrice) - originalPrice) / originalPrice) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total línea:</span>
                      <span>S/{(parseFloat(newPrice) * quantity).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => handleSavePrice(parseFloat(newPrice), discountReason)}>
                  Aplicar Precio
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="wholesale" className="space-y-4">
              <div className="space-y-2">
                <Label>Precios por Mayor (según cantidad)</Label>
                <div className="space-y-2">
                  {wholesaleTiers.map((tier, index) => (
                    <div 
                      key={index}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        quantity >= tier.minQuantity ? 'border-primary bg-primary/5' : 'border-muted'
                      }`}
                      onClick={() => handleSavePrice(tier.price, tier.label)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{tier.label}</div>
                          <div className="text-sm text-muted-foreground">
                            Mínimo {tier.minQuantity} unidad{tier.minQuantity > 1 ? 'es' : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">S/{tier.price.toFixed(2)}</div>
                          <div className="text-sm text-muted-foreground">
                            Total: S/{(tier.price * quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="discounts" className="space-y-4">
              <div className="space-y-2">
                <Label>Descuentos Rápidos</Label>
                <div className="grid grid-cols-1 gap-2">
                  {quickDiscounts.map((discount, index) => {
                    const discountedPrice = originalPrice * (1 - discount.percentage / 100);
                    return (
                      <div 
                        key={index}
                        className="p-3 border rounded-lg cursor-pointer hover:border-primary transition-colors"
                        onClick={() => applyQuickDiscount(discount.percentage, discount.label)}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{discount.label}</div>
                            <div className="text-sm text-muted-foreground">
                              -{discount.percentage}% de descuento
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">S/{discountedPrice.toFixed(2)}</div>
                            <div className="text-sm text-muted-foreground">
                              Total: S/{(discountedPrice * quantity).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="gift" className="space-y-4">
              <div className="text-center space-y-4">
                <div className="p-6 border-2 border-dashed border-green-200 rounded-lg bg-green-50">
                  <Gift className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-green-800">Producto de Regalo</h3>
                  <p className="text-sm text-green-600 mb-4">
                    Marcar este producto como regalo (precio S/0.00)
                  </p>
                  <Button onClick={applyGift} className="bg-green-600 hover:bg-green-700">
                    <Gift className="h-4 w-4 mr-2" />
                    Aplicar como Regalo
                  </Button>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <p>• El producto aparecerá en la nota con precio S/0.00</p>
                  <p>• Se descontará del inventario normalmente</p>
                  <p>• Ideal para promociones tipo "Compra X, llévate Y gratis"</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}