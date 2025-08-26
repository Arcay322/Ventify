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
import { CashRegisterSession } from '@/types/cash-register';
import { closeCashRegisterSession } from '@/services/cash-register-service';
import { Separator } from './ui/separator';

const closeRegisterSchema = z.object({
    countedAmount: z.coerce.number().min(0, "El monto contado no puede ser negativo."),
});

type CloseRegisterFormValues = z.infer<typeof closeRegisterSchema>;

interface CloseRegisterModalProps {
    session: CashRegisterSession;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CloseRegisterModal({ session, isOpen, onOpenChange }: CloseRegisterModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    
    const form = useForm<CloseRegisterFormValues>({
        resolver: zodResolver(closeRegisterSchema),
        defaultValues: {
            countedAmount: 0,
        }
    });

    const countedAmount = form.watch('countedAmount');
    const expectedAmount = session.initialAmount + session.cashSales;
    const difference = countedAmount - expectedAmount;

    const onSubmit = async (data: CloseRegisterFormValues) => {
        setLoading(true);
        try {
            await closeCashRegisterSession(session.id, data.countedAmount);
            toast({
                title: "Caja Cerrada Exitosamente",
                description: "La sesión de caja ha sido cerrada y archivada.",
            });
            onOpenChange(false);
        } catch (error) {
            console.error("Error closing register:", error);
            toast({
                title: "Error",
                description: "No se pudo cerrar la caja. Inténtalo de nuevo.",
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
    
    const getDifferenceClass = () => {
        if (difference < 0) return 'text-destructive';
        if (difference > 0) return 'text-green-600';
        return '';
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Cerrar Caja y Realizar Arqueo</DialogTitle>
                    <DialogDescription>
                        Calcula los totales y el efectivo contado para cerrar el turno.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-2">
                    <div className="space-y-2 rounded-lg border p-4">
                         <h4 className="text-sm font-semibold">Resumen de la Sesión</h4>
                         <Separator />
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Monto Inicial</span>
                            <span>S/{session.initialAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Ventas en Efectivo</span>
                            <span>+ S/{session.cashSales.toFixed(2)}</span>
                        </div>
                         <Separator />
                        <div className="flex justify-between font-semibold">
                            <span className="text-foreground">Efectivo Esperado en Caja</span>
                            <span>S/{expectedAmount.toFixed(2)}</span>
                        </div>
                    </div>

                     <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                            <FormField
                                control={form.control}
                                name="countedAmount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Monto Contado en Caja</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">S/</span>
                                                <Input type="number" step="0.01" placeholder="0.00" className="pl-7 font-bold text-lg h-12" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </form>
                    </Form>

                    <div className="flex justify-between font-bold text-lg border-t pt-4">
                        <span className="text-foreground">Diferencia</span>
                        <span className={getDifferenceClass()}>
                            {difference >= 0 ? `+S/${difference.toFixed(2)}` : `-S/${Math.abs(difference).toFixed(2)}`}
                        </span>
                    </div>

                </div>

                <DialogFooter className="mt-4">
                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" form="close-register-form" disabled={loading} onClick={form.handleSubmit(onSubmit)}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar y Cerrar Caja
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
