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
import type { Product } from '@/types/product';
import { saveProduct } from '@/services/product-service';
import { Loader2 } from 'lucide-react';
import { mockBranches } from '@/lib/mock-data';
import { Label } from './ui/label';

const productSchema = z.object({
    name: z.string().min(1, "El nombre es requerido."),
    sku: z.string().min(1, "El SKU es requerido."),
    category: z.string().min(1, "La categoría es requerida."),
    price: z.coerce.number().min(0, "El precio no puede ser negativo."),
    costPrice: z.coerce.number().min(0, "El precio de costo no puede ser negativo."),
    supplier: z.string().optional(),
    // El stock ahora es un objeto que validaremos dinámicamente
    stock: z.record(z.coerce.number().int().min(0, "El stock no puede ser negativo.")),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductModalProps {
    product: Product | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProductModal({ product, isOpen, onOpenChange }: ProductModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    
    const defaultStock = mockBranches.reduce((acc, branch) => {
        acc[branch.id] = 0;
        return acc;
    }, {} as Record<string, number>);

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            name: '',
            sku: '',
            category: '',
            price: 0,
            costPrice: 0,
            supplier: '',
            stock: defaultStock,
        }
    });

    useEffect(() => {
        if (isOpen) {
            if (product) {
                // Si estamos editando, llenamos con los datos del producto
                const stockValues = mockBranches.reduce((acc, branch) => {
                    acc[branch.id] = product.stock[branch.id] || 0;
                    return acc;
                }, {} as Record<string, number>);

                form.reset({
                    name: product.name,
                    sku: product.sku,
                    category: product.category,
                    price: product.price,
                    costPrice: product.costPrice,
                    supplier: product.supplier || '',
                    stock: stockValues,
                });
            } else {
                // Si estamos creando, reseteamos a los valores por defecto
                form.reset({
                    name: '',
                    sku: '',
                    category: '',
                    price: 0,
                    costPrice: 0,
                    supplier: '',
                    stock: defaultStock,
                });
            }
        }
    }, [isOpen, product, form, defaultStock]);

    const onSubmit = async (data: ProductFormValues) => {
        setLoading(true);
        try {
            const productToSave: Omit<Product, 'id'> & { id?: string } = {
                ...data,
                id: product?.id,
                imageUrl: product?.imageUrl || `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 100)}`,
                hint: product?.hint || 'product image',
            };

            await saveProduct(productToSave);
            
            toast({
                title: `Producto ${product ? 'actualizado' : 'creado'}`,
                description: `El producto "${data.name}" ha sido guardado exitosamente.`,
            });
            onOpenChange(false);
        } catch (error) {
            console.error("Error saving product:", error);
            toast({
                title: "Error",
                description: "No se pudo guardar el producto.",
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
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{product ? 'Editar Producto' : 'Agregar Nuevo Producto'}</DialogTitle>
                    <DialogDescription>
                        {product ? 'Edita los detalles de tu producto.' : 'Completa el formulario para añadir un nuevo producto.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="sku" render={({ field }) => (
                            <FormItem><FormLabel>SKU</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem><FormLabel>Categoría</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="price" render={({ field }) => (
                                <FormItem><FormLabel>Precio Venta</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="costPrice" render={({ field }) => (
                                <FormItem><FormLabel>Precio Costo</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                        <FormField control={form.control} name="supplier" render={({ field }) => (
                            <FormItem><FormLabel>Proveedor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        
                        <div>
                            <Label className="mb-3 block">Stock Inicial por Sucursal</Label>
                            <div className="space-y-2 rounded-md border p-4">
                                {mockBranches.map((branch) => (
                                     <FormField
                                        key={branch.id}
                                        control={form.control}
                                        name={`stock.${branch.id}`}
                                        render={({ field }) => (
                                            <FormItem className="flex items-center justify-between">
                                                <FormLabel>{branch.name}</FormLabel>
                                                <FormControl>
                                                    <Input type="number" className="w-24" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        <DialogFooter className="mt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Producto
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
