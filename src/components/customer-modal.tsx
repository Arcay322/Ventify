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
import type { Customer } from '@/types/customer';

const customerSchema = z.object({
    name: z.string().min(1, "El nombre es requerido."),
    email: z.string().email("Debe ser un email válido."),
    phone: z.string().min(1, "El teléfono es requerido."),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerModalProps {
    customer: Customer | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (customer: Customer) => void;
}

export function CustomerModal({ customer, isOpen, onOpenChange, onSave }: CustomerModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const form = useForm<CustomerFormValues>({
        resolver: zodResolver(customerSchema),
        defaultValues: {
            name: '',
            email: '',
            phone: '',
        }
    });

    useEffect(() => {
        if (isOpen && customer) {
            form.reset({
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
            });
        } else if (isOpen && !customer) {
            form.reset({
                name: '',
                email: '',
                phone: '',
            });
        }
    }, [isOpen, customer, form]);

    const onSubmit = async (data: CustomerFormValues) => {
        setLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const customerToSave: Customer = {
            id: customer?.id || `cus-${Date.now()}`,
            ...data,
            totalPurchases: customer?.totalPurchases || 0,
            totalSpent: customer?.totalSpent || 0,
        };

        onSave(customerToSave);
        
        toast({
            title: `Cliente ${customer ? 'actualizado' : 'creado'}`,
            description: `El cliente "${data.name}" ha sido guardado exitosamente.`,
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
                    <DialogTitle>{customer ? 'Editar Cliente' : 'Agregar Nuevo Cliente'}</DialogTitle>
                    <DialogDescription>
                        {customer ? 'Edita los detalles del cliente.' : 'Completa el formulario para añadir un nuevo cliente.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre Completo</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Juan Pérez" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="Ej: juan.perez@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Teléfono</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: +123456789" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter className="mt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Cliente
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
