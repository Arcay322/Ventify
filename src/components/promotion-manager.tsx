"use client"

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Gift, Plus, Percent, Tag } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/types/product';

import { CartItem } from '@/types/sale';

interface PromotionManagerProps {
  cart: CartItem[];
  products: Product[];
  onAddToCart: (product: Product, quantity: number, price: number, reason: string) => void;
  onApplyPromotion: (promotionType: string, details: any) => void;
}

interface PromotionRule {
  id: string;
  name: string;
  type: 'buy_x_get_y' | 'quantity_discount' | 'total_discount' | 'free_product';
  description: string;
  conditions: any;
  benefits: any;
  active: boolean;
}

export function PromotionManager({ 
  cart, 
  products, 
  onAddToCart, 
  onApplyPromotion 
}: PromotionManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<string>('');
  const [giftProductId, setGiftProductId] = useState<string>('');
  const [giftQuantity, setGiftQuantity] = useState(1);
  const { toast } = useToast();

  // Promociones predefinidas (en un sistema real, estas vendrían de la base de datos)
  const promotionRules: PromotionRule[] = [
    {
      id: 'buy_2_get_1',
      name: 'Compra 2, llévate 1 gratis',
      type: 'buy_x_get_y',
      description: 'Por cada 2 productos del mismo tipo, el tercero es gratis',
      conditions: { buyQuantity: 2, sameProduct: true },
      benefits: { freeQuantity: 1 },
      active: true
    },
    {
      id: 'bulk_discount_10',
      name: 'Descuento por volumen 10+',
      type: 'quantity_discount',
      description: '10% de descuento en productos con 10+ unidades',
      conditions: { minQuantity: 10 },
      benefits: { discountPercentage: 10 },
      active: true
    },
    {
      id: 'total_500_discount',
      name: 'Descuento por compra mayor a S/500',
      type: 'total_discount',
      description: '5% de descuento en compras mayores a S/500',
      conditions: { minTotal: 500 },
      benefits: { discountPercentage: 5 },
      active: true
    }
  ];

  const availableProducts = products.filter(p => 
    !cart.some(c => c.id === p.id) && p.stock && 
    Object.values(p.stock).some(s => s > 0)
  );

  const handleAddGiftProduct = () => {
    const product = products.find(p => p.id === giftProductId);
    if (!product) {
      toast({
        title: 'Error',
        description: 'Producto no encontrado',
        variant: 'destructive'
      });
      return;
    }

    onAddToCart(product, giftQuantity, 0, 'Producto de regalo');
    toast({
      title: 'Regalo agregado',
      description: `${giftQuantity}x ${product.name} agregado como regalo`
    });
    
    setGiftProductId('');
    setGiftQuantity(1);
    setIsOpen(false);
  };

  const applyBuyXGetYPromotion = (rule: PromotionRule) => {
    const { buyQuantity, sameProduct } = rule.conditions;
    const { freeQuantity } = rule.benefits;

    if (sameProduct) {
      // Aplicar a productos del mismo tipo
      cart.forEach(item => {
        if (item.quantity >= buyQuantity + freeQuantity) {
          const freeItems = Math.floor(item.quantity / (buyQuantity + freeQuantity)) * freeQuantity;
          if (freeItems > 0) {
            const product = products.find(p => p.id === item.id);
            if (product) {
              onAddToCart(product, freeItems, 0, `Promoción: ${rule.name}`);
            }
          }
        }
      });
    }

    toast({
      title: 'Promoción aplicada',
      description: rule.description
    });
  };

  const applyQuantityDiscount = (rule: PromotionRule) => {
    const { minQuantity } = rule.conditions;
    const { discountPercentage } = rule.benefits;

    cart.forEach(item => {
      if (item.quantity >= minQuantity) {
        const discountedPrice = (item.originalPrice || item.price) * (1 - discountPercentage / 100);
        onApplyPromotion('quantity_discount', {
          productId: item.id,
          newPrice: discountedPrice,
          reason: `${rule.name} (-${discountPercentage}%)`
        });
      }
    });

    toast({
      title: 'Descuento aplicado',
      description: `${discountPercentage}% de descuento en productos elegibles`
    });
  };

  const applyTotalDiscount = (rule: PromotionRule) => {
    const { minTotal } = rule.conditions;
    const { discountPercentage } = rule.benefits;
    
    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (cartTotal >= minTotal) {
      onApplyPromotion('total_discount', {
        discountPercentage,
        reason: rule.name
      });
      
      toast({
        title: 'Descuento aplicado',
        description: `${discountPercentage}% de descuento por compra mayor a S/${minTotal}`
      });
    } else {
      toast({
        title: 'Promoción no aplicable',
        description: `Necesitas comprar S/${(minTotal - cartTotal).toFixed(2)} más para aplicar esta promoción`,
        variant: 'destructive'
      });
    }
  };

  const handleApplyPromotion = (rule: PromotionRule) => {
    switch (rule.type) {
      case 'buy_x_get_y':
        applyBuyXGetYPromotion(rule);
        break;
      case 'quantity_discount':
        applyQuantityDiscount(rule);
        break;
      case 'total_discount':
        applyTotalDiscount(rule);
        break;
    }
    setIsOpen(false);
  };

  const getPromotionIcon = (type: string) => {
    switch (type) {
      case 'buy_x_get_y':
        return <Gift className="h-4 w-4" />;
      case 'quantity_discount':
        return <Tag className="h-4 w-4" />;
      case 'total_discount':
        return <Percent className="h-4 w-4" />;
      default:
        return <Plus className="h-4 w-4" />;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="w-full"
      >
        <Gift className="h-4 w-4 mr-2" />
        Promociones y Regalos
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Promociones y Productos de Regalo</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Sección de Promociones Automáticas */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Promociones Disponibles</h3>
              <div className="space-y-2">
                {promotionRules.filter(rule => rule.active).map(rule => (
                  <div 
                    key={rule.id}
                    className="p-3 border rounded-lg hover:border-primary transition-colors cursor-pointer"
                    onClick={() => handleApplyPromotion(rule)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-md">
                          {getPromotionIcon(rule.type)}
                        </div>
                        <div>
                          <h4 className="font-medium">{rule.name}</h4>
                          <p className="text-sm text-muted-foreground">{rule.description}</p>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {rule.type === 'buy_x_get_y' ? 'Regalo' : 'Descuento'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sección de Productos de Regalo Manual */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Agregar Producto de Regalo</h3>
              <div className="space-y-4">
                <div>
                  <Label>Seleccionar Producto</Label>
                  <Select value={giftProductId} onValueChange={setGiftProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Elegir producto para regalar" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{product.name}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              S/{product.price.toFixed(2)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min="1"
                    value={giftQuantity}
                    onChange={(e) => setGiftQuantity(parseInt(e.target.value) || 1)}
                    className="w-24"
                  />
                </div>

                <Button 
                  onClick={handleAddGiftProduct}
                  disabled={!giftProductId}
                  className="w-full"
                >
                  <Gift className="h-4 w-4 mr-2" />
                  Agregar como Regalo
                </Button>
              </div>
            </div>

            {/* Resumen del carrito actual */}
            {cart.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">Carrito Actual</h3>
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <span>{item.name} x{item.quantity}</span>
                      <div className="flex items-center gap-2">
                        {item.price === 0 && (
                          <Badge variant="outline" className="text-green-600">
                            Regalo
                          </Badge>
                        )}
                        <span>S/{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-2 font-semibold">
                    Total: S/{cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}