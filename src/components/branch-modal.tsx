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
import { Loader2 } from 'lucide-react';
import type { Branch } from '@/types/branch';

const branchSchema = z.object({
    name: z.string().min(1, "El nombre es requerido."),
    address: z.string().min(1, "La dirección es requerida."),
});

type BranchFormValues = z.infer<typeof branchSchema>;

interface BranchModalProps {
    branch: Branch | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (branch: Branch) => void;
}

export function BranchModal({ branch, isOpen, onOpenChange, onSave }: BranchModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const form = useForm<BranchFormValues>({
        resolver: zodResolver(branchSchema),
        defaultValues: {
            name: '',
            address: '',
        }
    });

    useEffect(() => {
        if (isOpen && branch) {
            form.reset({
                name: branch.name,
                address: branch.address,
            });
        } else if (isOpen && !branch) {
            form.reset({
                name: '',
                address: '',
            });
        }
    }, [isOpen, branch, form]);

    const onSubmit = async (data: BranchFormValues) => {
        setLoading(true);
        // Simular llamada a la API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const branchToSave: Branch = {
            id: branch?.id || `branch-${Date.now()}`,
            ...data,
        };

        onSave(branchToSave);
        
        toast({
            title: `Sucursal ${branch ? 'actualizada' : 'creada'}`,
            description: `La sucursal "${data.name}" ha sido guardada exitosamente.`,
        });
        setLoading(false);
        onOpenChange(false);
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            form.reset();
        }
        onOpenChange(open);
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>{branch ? 'Editar Sucursal' : 'Agregar Nueva Sucursal'}</DialogTitle>
                    <DialogDescription>
                        {branch ? 'Edita los detalles de la sucursal.' : 'Completa el formulario para añadir una nueva sucursal.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre de la Sucursal</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Tienda Centro" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Dirección</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Av. Principal 123" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter className="mt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Sucursal
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
