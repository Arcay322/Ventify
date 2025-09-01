"use client"

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Edit3 } from "lucide-react";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';

interface PriceEditorProps {
  productName: string;
  originalPrice: number;
  currentPrice: number;
  onPriceChange: (newPrice: number) => void;
  disabled?: boolean;
}

export function PriceEditor({ 
  productName, 
  originalPrice, 
  currentPrice, 
  onPriceChange, 
  disabled = false 
}: PriceEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newPrice, setNewPrice] = useState(currentPrice.toString());
  const { toast } = useToast();
  const authState = useAuth();
  const { canModifyPrice } = usePermissions();

  const handleSavePrice = () => {
    const price = parseFloat(newPrice);
    
    if (isNaN(price) || price < 0) {
      toast({ 
        title: 'Precio inválido', 
        description: 'Ingresa un precio válido mayor o igual a 0', 
        variant: 'destructive' 
      });
      return;
    }

    if (price > originalPrice * 2) {
      toast({ 
        title: 'Precio muy alto', 
        description: 'El precio no puede ser más del doble del precio original', 
        variant: 'destructive' 
      });
      return;
    }

    onPriceChange(price);
    setIsOpen(false);
    
    if (price !== originalPrice) {
      toast({ 
        title: 'Precio modificado', 
        description: `Precio cambiado de S/${originalPrice.toFixed(2)} a S/${price.toFixed(2)}` 
      });
    }
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
    setIsOpen(true);
  };

  if (disabled || !canModifyPrice()) {
    return null;
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={handleOpenDialog}
        title="Modificar precio"
      >
        <Edit3 className="h-3 w-3" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modificar Precio</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">Producto</Label>
              <div className="text-sm text-muted-foreground">{productName}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Precio Original</Label>
                <div className="text-lg font-semibold">S/{originalPrice.toFixed(2)}</div>
              </div>
              <div>
                <Label className="text-sm">Precio Actual</Label>
                <div className="text-lg font-semibold text-primary">S/{currentPrice.toFixed(2)}</div>
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

            {parseFloat(newPrice) !== originalPrice && !isNaN(parseFloat(newPrice)) && (
              <div className="p-3 bg-muted rounded-md">
                <div className="text-sm">
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
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePrice}>
              Aplicar Precio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}