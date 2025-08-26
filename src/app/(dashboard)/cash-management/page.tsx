"use client"

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { CashRegisterSession } from '@/types/cash-register';
import { CloseRegisterModal } from '@/components/close-register-modal';

const openRegisterSchema = z.object({
    initialAmount: z.coerce.number().min(0, "El monto inicial no puede ser negativo."),
});

type OpenRegisterFormValues = z.infer<typeof openRegisterSchema>;

const mockInitialSession: CashRegisterSession = {
    id: 'mock-session-123',
    initialAmount: 50.00,
    openTime: new Date().getTime(),
    status: 'open',
    totalSales: 350.75,
    cashSales: 150.25,
    cardSales: 175.50,
    digitalSales: 25.00,
};

export default function CashManagementPage() {
    const [actionLoading, setActionLoading] = useState(false);
    const [activeSession, setActiveSession] = useState<CashRegisterSession | null>(null);
    const { toast } = useToast();
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

    const form = useForm<OpenRegisterFormValues>({
        resolver: zodResolver(openRegisterSchema),
        defaultValues: {
            initialAmount: 0,
        }
    });

    const onOpenRegister = async (data: OpenRegisterFormValues) => {
        setActionLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newSession: CashRegisterSession = {
            id: `mock-session-${Math.random().toString(36).substring(2, 9)}`,
            initialAmount: data.initialAmount,
            openTime: new Date().getTime(),
            status: 'open',
            totalSales: 0,
            cashSales: 0,
            cardSales: 0,
            digitalSales: 0,
        };

        setActiveSession(newSession);
        
        toast({
            title: "Caja Abierta (Simulado)",
            description: `La caja se abrió con un monto inicial de S/${data.initialAmount.toFixed(2)}.`,
        });

        setActionLoading(false);
    };

    const handleCloseRegister = () => {
        if (!activeSession) return;
        setIsCloseModalOpen(true);
    }
    
    const handleSimulateOpen = () => {
        setActiveSession(mockInitialSession);
    }

    const handleSimulateClose = () => {
        setActiveSession(null);
    }

    return (
        <>
            <div className="flex flex-col gap-8">
                 <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Gestión de Caja</h1>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleSimulateOpen}>Simular Caja Abierta</Button>
                        <Button variant="outline" onClick={handleSimulateClose}>Simular Caja Cerrada</Button>
                    </div>
                </div>

                {!activeSession ? (
                     <Card className="w-full max-w-lg mx-auto">
                        <CardHeader>
                            <CardTitle>Abrir Caja</CardTitle>
                            <CardDescription>Ingresa el monto inicial de efectivo para comenzar el día.</CardDescription>
                        </CardHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onOpenRegister)}>
                                <CardContent>
                                    <FormField
                                        control={form.control}
                                        name="initialAmount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Monto Inicial</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">S/</span>
                                                        <Input type="number" step="0.01" placeholder="0.00" className="pl-7" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                                <CardFooter>
                                    <Button type="submit" className="w-full" disabled={actionLoading}>
                                        {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Abrir Caja
                                    </Button>
                                </CardFooter>
                            </form>
                        </Form>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle>Estado de Caja</CardTitle>
                                <CardDescription>La caja está actualmente abierta.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                               <div className="flex justify-between">
                                    <span className="text-muted-foreground">Monto Inicial:</span>
                                    <span className="font-semibold">S/{activeSession.initialAmount.toFixed(2)}</span>
                               </div>
                               <div className="flex justify-between">
                                    <span className="text-muted-foreground">Hora de Apertura:</span>
                                    <span className="font-semibold">{new Date(activeSession.openTime).toLocaleTimeString()}</span>
                               </div>
                               <div className="flex justify-between">
                                    <span className="text-muted-foreground">Ventas en Efectivo:</span>
                                    <span className="font-semibold">S/{activeSession.cashSales.toFixed(2)}</span>
                               </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Ventas con Tarjeta:</span>
                                    <span className="font-semibold">S/{activeSession.cardSales.toFixed(2)}</span>
                               </div>
                               <div className="flex justify-between">
                                    <span className="text-muted-foreground">Ventas Digitales:</span>
                                    <span className="font-semibold">S/{activeSession.digitalSales.toFixed(2)}</span>
                               </div>
                                 <div className="flex justify-between">
                                    <span className="text-muted-foreground">Ventas Totales:</span>
                                    <span className="font-semibold">S/{activeSession.totalSales.toFixed(2)}</span>
                               </div>
                               <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total en Caja (Estimado):</span>
                                    <span className="font-bold text-lg">S/{(activeSession.initialAmount + activeSession.cashSales).toFixed(2)}</span>
                               </div>
                            </CardContent>
                            <CardFooter>
                                <Button variant="destructive" className="w-full" onClick={handleCloseRegister}>
                                    Cerrar Caja
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                )}
            </div>
            {activeSession && (
                <CloseRegisterModal 
                    session={activeSession}
                    isOpen={isCloseModalOpen}
                    onOpenChange={setIsCloseModalOpen}
                />
            )}
        </>
    );
}
