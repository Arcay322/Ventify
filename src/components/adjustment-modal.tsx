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
}

export function AdjustmentModal({ product, isOpen, onOpenChange }: AdjustmentModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const form = useForm<AdjustmentFormValues>({
        resolver: zodResolver(adjustmentSchema),
    });

    const [branches, setBranches] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && product) {
            form.reset({
                stock: product.stock,
            });
        }
    }, [isOpen, product, form]);

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
            // La lógica para guardar el producto se actualizaría para manejar el nuevo formato de stock
            await saveProduct({ id: product.id, stock: data.stock });

            // Registrar auditoría del ajuste
            await addDoc(collection(db, 'inventory_adjustments'), {
                productId: product.id,
                productName: product.name,
                before: product.stock,
                after: data.stock,
                changedAt: Date.now(),
                user: null,
            });
            
            toast({
                title: "Stock Actualizado",
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
                    <DialogTitle>Ajuste Manual de Stock</DialogTitle>
                    <DialogDescription>
                        Actualiza la cantidad de stock para <span className="font-semibold">{product?.name}</span> en cada sucursal.
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
                                            <FormLabel className="w-1/2">{branch.name}</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="0" {...field} className="w-1/2" />
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
