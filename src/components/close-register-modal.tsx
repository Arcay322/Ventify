"use client"

import { useState, useEffect } from 'react';
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
import { closeCashRegisterSession, getMovementsForSession, getCashRegisterReport } from '@/services/cash-register-service';
import { Separator } from './ui/separator';
import { CashRegisterReport } from './cash-register-report';

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
    const [sessionClosed, setSessionClosed] = useState(false);
    // Local UI state for showing the internal report preview (kept for compatibility)
    const [showReport, setShowReport] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    
    const form = useForm<CloseRegisterFormValues>({
        resolver: zodResolver(closeRegisterSchema),
        defaultValues: {
            countedAmount: 0,
        }
    });

    const countedAmount = form.watch('countedAmount');
    const [movements, setMovements] = useState<any[]>([]);
    
    useEffect(() => {
        if (!isOpen || sessionClosed) {
            // Clear movements when modal is closed or session is closed
            setMovements([]);
            return;
        }
        const unsub = getMovementsForSession(session.id, setMovements);
        return () => { try { unsub(); } catch(e){} };
    }, [session.id, isOpen, sessionClosed]);

    const otherIncomes = movements.filter(m => m.amount > 0).reduce((s, m) => s + (m.amount || 0), 0);
    const withdrawals = movements.filter(m => m.amount < 0).reduce((s, m) => s + (m.amount || 0), 0);
        // Prefer authoritative server-side stored expectedAmount when available to avoid double-counting
        // (server increments expectedAmount on each movement). If not present, compute locally from components.
        const computedExpected = (session.initialAmount || 0) + (session.cashSales || 0) + otherIncomes + withdrawals;
        const expectedAmount = typeof session.expectedAmount === 'number' ? session.expectedAmount : computedExpected;
    const difference = countedAmount - expectedAmount;

    const onSubmit = async (data: CloseRegisterFormValues) => {
        setLoading(true);
        try {
            const result = await closeCashRegisterSession(session.id, data.countedAmount);
            setSessionClosed(true);
            toast({
                title: "Caja Cerrada Exitosamente",
                description: "La sesión de caja ha sido cerrada y archivada.",
            });
            // Close this modal first
            handleOpenChange(false);
            // Notifica al padre para mostrar el reporte Z
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('show-cash-register-report', { detail: { sessionId: session.id } }));
            }
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
            setShowReport(false);
            setReportData(null);
            setMovements([]); // Clear movements when closing
            setSessionClosed(false); // Reset session closed state
        }
        onOpenChange(open);
    }
    
    const getDifferenceClass = () => {
        if (difference < 0) return 'text-destructive';
        if (difference > 0) return 'text-green-600';
        return '';
    }

    return (
        <>
            {!showReport && (
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
                                <span>S/{(session.initialAmount || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Ventas en Efectivo</span>
                                <span>+ S/{(session.cashSales || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Otros Ingresos</span>
                                <span>+ S/{otherIncomes.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Retiros</span>
                                <span>- S/{Math.abs(withdrawals).toFixed(2)}</span>
                            </div>
                             <Separator />
                            <div className="flex justify-between font-semibold">
                                <span className="text-foreground">Efectivo Esperado en Caja</span>
                                <span>S/{expectedAmount.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="mt-2 space-y-2">
                            <h4 className="text-sm font-semibold">Movimientos de Caja</h4>
                            <div className="max-h-40 overflow-y-auto border rounded p-2">
                                {movements.length === 0 ? <div className="text-sm text-muted-foreground">No hay movimientos registrados.</div> : (
                                    movements.map(m => (
                                        <div key={m.id} className="flex justify-between text-sm py-1 border-b last:border-b-0">
                                            <div>
                                                <div className="font-medium">{m.reason || (m.amount>0 ? 'Ingreso' : 'Retiro')}</div>
                                                <div className="text-xs text-muted-foreground">{m.createdAt ? new Date(m.createdAt.seconds * 1000).toLocaleString() : ''}</div>
                                            </div>
                                            <div className={`font-semibold ${m.amount < 0 ? 'text-destructive' : ''}`}>S/{m.amount.toFixed(2)}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                         <Form {...form}>
                            <form id="close-register-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
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
            )}

            {/* El reporte Z ahora se muestra desde CashManagementPage */}
        </>
    );
}
