
"use client"

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Sale } from '@/types/sale';
import { applyAdjustments } from '@/services/inventory-service';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Separator } from './ui/separator';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

const returnSchema = z.object({
  // No necesitamos un schema complejo, la lógica se manejará en el estado.
});

interface ReturnModalProps {
  sale: Sale | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReturnModal({ sale, isOpen, onOpenChange }: ReturnModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});

  const handleCheckboxChange = (itemId: string) => {
    setSelectedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const processReturn = async () => {
    if (!sale) return;
    setLoading(true);

    const itemsToReturn = sale.items.filter(item => selectedItems[item.id]);
    if(itemsToReturn.length === 0) {
      toast({ title: "Error", description: "Debes seleccionar al menos un producto para devolver.", variant: "destructive" });
      setLoading(false);
      return;
    }

    try {
      // Build adjustments (positive to increase stock)
      const adjustments = itemsToReturn.map(item => ({ productId: item.id, branchId: sale.branchId, delta: Number(item.quantity) }));
      await applyAdjustments(adjustments);

      // Create a credit record for auditing
      await addDoc(collection(db, 'credits'), {
        saleId: sale.id,
        branchId: sale.branchId,
        items: itemsToReturn.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, amount: i.price * i.quantity })),
        total: itemsToReturn.reduce<number>((a, b) => a + b.price * b.quantity, 0),
        createdAt: Date.now(),
      });

      toast({
        title: "Devolución Procesada",
        description: `Se ha generado una nota de crédito y se ha devuelto el stock.`,
      });
    } catch (err: any) {
      console.error('Return processing failed', err);
      toast({ title: 'Error', description: err.message || 'Error procesando devolución', variant: 'destructive' });
    }
    setLoading(false);
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedItems({});
    }
    onOpenChange(open);
  }

  const itemsForReturn = sale?.items || [];
  const totalToReturn = itemsForReturn
    .filter(item => selectedItems[item.id])
    .reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Procesar Devolución</DialogTitle>
          <DialogDescription>
            Selecciona los productos de la venta <span className="font-mono font-semibold">#{sale?.saleNumber || sale?.id.slice(-6)}</span> para devolverlos al inventario.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
            <div className="space-y-2 rounded-lg border p-4">
                <h4 className="text-sm font-semibold">Productos en la Venta Original</h4>
                <Separator />
                <div className="space-y-3 max-h-60 overflow-y-auto">
                {itemsForReturn.map(item => (
                    <div key={item.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Checkbox 
                                id={`return-${item.id}`} 
                                checked={selectedItems[item.id] || false}
                                onCheckedChange={() => handleCheckboxChange(item.id)}
                            />
                            <Label htmlFor={`return-${item.id}`} className="cursor-pointer">
                                {item.name} <span className="text-muted-foreground">(Cant: {item.quantity})</span>
                            </Label>
                        </div>
                        <span className="font-medium">S/{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                ))}
                </div>
            </div>

            {totalToReturn > 0 && (
                <div className="flex justify-between font-bold text-lg border-t pt-4">
                    <span className="text-foreground">Total a Devolver:</span>
                    <span className="text-destructive">-S/{totalToReturn.toFixed(2)}</span>
                </div>
            )}
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={processReturn} disabled={loading || totalToReturn === 0} variant="destructive">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    