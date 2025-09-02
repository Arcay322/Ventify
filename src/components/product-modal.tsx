"use client"

import { useEffect, useState, useMemo } from 'react';
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
import { uploadImage, generateImagePath, validateImageFile } from '@/services/upload-service';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { getBranches } from '@/services/branch-service';
import { useAuth } from '@/hooks/use-auth';
import { Label } from './ui/label';
import Image from 'next/image';

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
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const defaultStock = useMemo(() => {
        return branches.reduce((acc, branch) => {
            acc[branch.id] = 0;
            return acc;
        }, {} as Record<string, number>);
    }, [branches]);

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
        // When opening the modal, or when branches change, ensure stock keys exist
        if (isOpen) {
            if (product) {
                // Si estamos editando, llenamos con los datos del producto
                const stockValues = branches.reduce((acc, branch) => {
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
                
                // Establecer la imagen preview si existe
                setImagePreview(product.imageUrl || null);
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
                
                // Limpiar imagen
                setImagePreview(null);
            }
            
            // Siempre limpiar el archivo seleccionado
            setImageFile(null);
        }
    }, [isOpen, product, form, branches]);

    // If branches change while modal is open and we're creating a new product,
    // ensure the form has stock fields for the new branches.
    useEffect(() => {
        if (!isOpen || product) return;
        const current = form.getValues();
        const newStock = { ...(current.stock || {}) } as Record<string, number>;
        let changed = false;
        for (const b of branches) {
            if (typeof newStock[b.id] !== 'number') { newStock[b.id] = 0; changed = true; }
        }
        if (changed) form.setValue('stock', newStock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branches]);

    const authState = useAuth();
    useEffect(() => {
    const accountId = authState.userDoc?.accountId as string | undefined;
    const unsubscribe = getBranches((b: { id: string; name: string }[]) => setBranches(b), accountId);
        return () => { try { unsubscribe(); } catch (e) {} };
    }, [authState.userDoc?.accountId]);

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            validateImageFile(file);
            setImageFile(file);
            
            // Crear preview - siempre reemplaza la imagen actual
            const reader = new FileReader();
            reader.onload = (e) => {
                setImagePreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Error al procesar la imagen",
                variant: "destructive"
            });
            // Limpiar el input
            event.target.value = '';
        }
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const onSubmit = async (data: ProductFormValues) => {
        setLoading(true);
        try {
            const accountId = authState.userDoc?.accountId as string;
            
            if (!accountId) {
                throw new Error('No se pudo obtener el ID de la cuenta');
            }
            
            let imageUrl = product?.imageUrl || null;
            
            // Si hay una nueva imagen seleccionada, subirla
            if (imageFile) {
                setUploadingImage(true);
                const imagePath = generateImagePath(imageFile.name, accountId, 'products');
                const uploadResult = await uploadImage(imageFile, imagePath, accountId);
                imageUrl = uploadResult.url;
                setUploadingImage(false);
            }
            
            const productToSave: Omit<Product, 'id'> & { id?: string } = {
                ...data,
                id: product?.id,
                accountId: accountId, // Incluir accountId
                imageUrl: imageUrl || `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 100)}`,
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
                description: error instanceof Error ? error.message : "No se pudo guardar el producto.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
            setUploadingImage(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            form.reset();
            setImageFile(null);
            setImagePreview(null);
        }
        onOpenChange(open);
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{product ? 'Editar Producto' : 'Agregar Nuevo Producto'}</DialogTitle>
                    <DialogDescription>
                        {product ? 'Edita los detalles de tu producto.' : 'Completa el formulario para añadir un nuevo producto.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-1">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                            {/* Campo de imagen */}
                            <div>
                                <Label className="mb-3 block">Imagen del Producto</Label>
                                <div className="space-y-4">
                                    {/* Preview de la imagen */}
                                    {imagePreview ? (
                                        <div className="relative w-full max-w-xs mx-auto">
                                            <div className="relative w-32 h-32 mx-auto">
                                                <Image
                                                    src={imagePreview}
                                                    alt="Preview"
                                                    fill
                                                    className="object-cover rounded-lg"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={removeImage}
                                                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                            {imageFile && (
                                                <p className="text-xs text-center text-muted-foreground mt-2">
                                                    Nueva imagen: {imageFile.name}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        /* Input para seleccionar imagen */
                                        <div className="flex items-center justify-center">
                                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground rounded-lg cursor-pointer hover:bg-muted/40">
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                                                    <p className="text-sm text-muted-foreground">
                                                        <span className="font-semibold">Clic para subir</span> o arrastra aquí
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">PNG, JPG, WebP (máx. 5MB)</p>
                                                </div>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={handleImageChange}
                                                />
                                            </label>
                                        </div>
                                    )}
                                    
                                    {/* Botón para cambiar imagen si ya hay una */}
                                    {imagePreview && (
                                        <div className="text-center">
                                            <label className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded-md cursor-pointer">
                                                <Upload className="w-4 h-4" />
                                                Cambiar imagen
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={handleImageChange}
                                                />
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>

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
                                <div className="space-y-2 rounded-md border p-4 max-h-40 overflow-y-auto">
                                    {branches.map((branch) => (
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
                        </form>
                    </Form>
                </div>
                <DialogFooter className="mt-4 flex-shrink-0">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" disabled={loading || uploadingImage} onClick={form.handleSubmit(onSubmit)}>
                        {(loading || uploadingImage) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {uploadingImage ? 'Subiendo imagen...' : 'Guardar Producto'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
