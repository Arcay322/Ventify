"use client"

import { useEffect, useState } from 'react';
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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { saveProduct } from '@/services/product-service';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Product } from '@/types/product';
import { getBranches } from '@/services/branch-service';
import { useAuth } from '@/hooks/use-auth';
import { Label } from './ui/label';

// El schema ahora valida un objeto de stocks
const adjustmentSchema = z.object({
    stock: z.record(z.coerce.number().int().min(0, "El stock no puede ser negativo.")),
});

type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;

interface AdjustmentModalProps {
    product: Product | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    mode?: 'add' | 'edit';
}

export function AdjustmentModal({ product, isOpen, onOpenChange, mode = 'edit' }: AdjustmentModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const form = useForm<AdjustmentFormValues>({
        resolver: zodResolver(adjustmentSchema),
    });

    const [branches, setBranches] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && product) {
            if (mode === 'add') {
                // En modo agregar, iniciamos con valores en 0
                const emptyStock: Record<string, number> = {};
                Object.keys(product.stock || {}).forEach(branchId => {
                    emptyStock[branchId] = 0;
                });
                form.reset({
                    stock: emptyStock,
                });
            } else {
                // En modo editar, usamos los valores actuales
                form.reset({
                    stock: product.stock,
                });
            }
        }
    }, [isOpen, product, mode, form]);

    const authState = useAuth();
    useEffect(() => {
        const accountId = authState.userDoc?.accountId as string | undefined;
        const unsub = getBranches((b: any) => setBranches(b), accountId);
        return () => { try { unsub(); } catch (e) {} };
    }, [authState.userDoc?.accountId]);

    const onSubmit = async (data: AdjustmentFormValues) => {
        if (!product) return;
        setLoading(true);
        try {
            let finalStock: Record<string, number>;
            
            if (mode === 'add') {
                // En modo agregar, sumamos las cantidades al stock actual
                finalStock = { ...product.stock };
                Object.entries(data.stock).forEach(([branchId, addAmount]) => {
                    if (addAmount > 0) {
                        finalStock[branchId] = (finalStock[branchId] || 0) + addAmount;
                    }
                });
            } else {
                // En modo editar, reemplazamos directamente
                finalStock = data.stock;
            }

            // La lógica para guardar el producto se actualizaría para manejar el nuevo formato de stock
            await saveProduct({ id: product.id, stock: finalStock });

            // Registrar auditoría del ajuste
            await addDoc(collection(db, 'inventory_adjustments'), {
                productId: product.id,
                productName: product.name,
                before: product.stock,
                after: finalStock,
                mode: mode,
                changedAt: Date.now(),
                user: null,
            });
            
            toast({
                title: mode === 'add' ? "Stock Agregado" : "Stock Actualizado",
                description: `El stock de "${product.name}" ha sido ajustado.`,
            });
            onOpenChange(false);
        } catch (error) {
            console.error("Error saving product stock:", error);
            toast({
                title: "Error",
                description: "No se pudo ajustar el stock del producto.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            form.reset();
        }
        onOpenChange(open);
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'add' ? 'Agregar Stock' : 'Ajuste Manual de Stock'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'add' 
                            ? `Aumenta la cantidad de stock para ${product?.name} en cada sucursal.`
                            : `Actualiza la cantidad de stock para ${product?.name} en cada sucursal.`
                        }
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                        <div className="space-y-4">
                            <Label>Cantidades por Sucursal</Label>
                            {branches.map(branch => (
                                <FormField
                                    key={branch.id}
                                    control={form.control}
                                    name={`stock.${branch.id}`}
                                    defaultValue={product?.stock[branch.id] || 0}
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between">
                                            <div className="w-1/2">
                                                <FormLabel>{branch.name}</FormLabel>
                                                {mode === 'add' && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Stock actual: {product?.stock[branch.id] || 0}
                                                    </p>
                                                )}
                                            </div>
                                            <FormControl>
                                                <Input 
                                                    type="number" 
                                                    placeholder={mode === 'add' ? "Cantidad a agregar" : "0"} 
                                                    min={mode === 'add' ? "0" : undefined}
                                                    {...field} 
                                                    className="w-1/2" 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ))}
                        </div>
                        <DialogFooter className="mt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Ajuste
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
