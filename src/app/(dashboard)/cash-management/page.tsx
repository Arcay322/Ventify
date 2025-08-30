"use client"

import { useState, useEffect } from 'react';
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
import { createCashRegisterSession, getActiveCashRegisterSession, closeCashRegisterSession } from '@/services/cash-register-service';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { getBranches } from '@/services/branch-service';
import { CloseRegisterModal } from '@/components/close-register-modal';
import { createCashMovement } from '@/services/cash-register-service';

const openRegisterSchema = z.object({
    initialAmount: z.coerce.number().min(0, "El monto inicial no puede ser negativo."),
});

type OpenRegisterFormValues = z.infer<typeof openRegisterSchema>;


export default function CashManagementPage() {
    const [actionLoading, setActionLoading] = useState(false);
    const [activeSession, setActiveSession] = useState<CashRegisterSession | null>(null);
    const authState = useAuth();
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(undefined);
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
        const branchId = authState.userDoc?.branchId as string | undefined;
        const accountId = authState.userDoc?.accountId as string | undefined || undefined;

        const effectiveBranchId = branchId ?? selectedBranchId;

        if (!accountId) {
            toast({ title: 'Cuenta no disponible', description: 'El identificador de cuenta no está cargado aún. Espera unos segundos e inténtalo de nuevo.', variant: 'destructive' });
            setActionLoading(false);
            return;
        }
        if (!effectiveBranchId) {
            toast({ title: 'Sucursal no definida', description: 'No se pudo determinar la sucursal del usuario.', variant: 'destructive' });
            setActionLoading(false);
            return;
        }

        // Pre-check: is there an open session for this branch? Use effectiveBranchId (handles owners who selected a branch)
        try {
            const coll = collection(db, 'cash_register_sessions');
                        const q = query(coll, where('branchId', '==', effectiveBranchId), where('accountId', '==', accountId), where('status', '==', 'open'), limit(1));
            // debug: log pre-check query
            try { console.info('[cash-register] pre-check query for open sessions', { effectiveBranchId, accountId }); } catch (e) {}
            const snaps = await getDocs(q as any);
            try { console.debug('[cash-register] pre-check snaps:', snaps.empty ? 'empty' : snaps.docs.map(d => ({ id: d.id, data: d.data() }))); } catch (e) {}
            if (!snaps.empty) {
                const doc = snaps.docs[0];
                const d = doc.data() as any;
                if (d.status === 'open') {
                    toast({ title: 'Ya existe una caja abierta', description: 'Ya hay una sesión de caja abierta para esta sucursal.', variant: 'destructive' });
                    setActionLoading(false);
                    return;
                }
            }
        } catch (e) {
            console.warn('Could not pre-check existing sessions', e);
            // continue and let server enforce
        }

        try {
            const uid = authState.user?.uid ?? authState.uid ?? '';
            const ok = await createCashRegisterSession(effectiveBranchId as string, data.initialAmount, uid, accountId);
            try { console.info('[cash-register] createCashRegisterSession result', { ok, effectiveBranchId, accountId, uid }); } catch(e){}
            if (ok) {
                toast({ title: 'Caja abierta', description: `Se abrió la caja con S/${data.initialAmount.toFixed(2)}` });
            } else {
                toast({ title: 'Ya existe una caja abierta', description: 'Ya hay una sesión de caja abierta para esta sucursal.' });
            }
        } catch (e) {
            console.error('Error opening cash register', e, { uid: authState.user?.uid, userDoc: authState.userDoc });
            const msg = (e as any)?.message || String(e);
            if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
                toast({ title: 'Permisos insuficientes', description: 'No tienes permisos para abrir la caja. Verifica que eres miembro de la cuenta o que tu rol es correcto.', variant: 'destructive' });
            } else {
                toast({ title: 'Error', description: 'No se pudo abrir la caja. ' + msg, variant: 'destructive' });
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleCloseRegister = () => {
        if (!activeSession) return;
        setIsCloseModalOpen(true);
    }
    
    // Dev helpers to simulate open/close during development
    // remove dev simulation helpers to avoid false positives during testing

    const [movementAmount, setMovementAmount] = useState<number | null>(null);
    const [movementReason, setMovementReason] = useState('');

    const registerMovement = async (amount: number) => {
        if (!activeSession) return toast({ title: 'No session', description: 'No hay una sesión abierta.', variant: 'destructive' });
        const accountId = authState.userDoc?.accountId;
        if (!accountId) return toast({ title: 'Cuenta no disponible', description: 'No se pudo determinar la cuenta; intenta recargar la página.', variant: 'destructive' });
        try {
            await createCashMovement(activeSession.id, amount, movementReason || (amount > 0 ? 'Ingreso' : 'Retiro'), accountId);
            toast({ title: 'Movimiento registrado', description: `S/${amount.toFixed(2)} registrado.` });
            setMovementAmount(null);
            setMovementReason('');
        } catch (e) {
            console.error('Failed to register movement', e, { uid: authState.user?.uid, userDoc: authState.userDoc });
            const msg = (e as any)?.message || String(e);
            if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
                toast({ title: 'Permisos insuficientes', description: 'No tienes permisos para registrar movimientos de caja. Verifica tu rol o contacto con el admin.', variant: 'destructive' });
            } else {
                toast({ title: 'Error', description: 'No se pudo registrar el movimiento. ' + msg, variant: 'destructive' });
            }
        }
    }
    
    // Load branches and set default selected branch when available
    useEffect(() => {
        const accountId = authState.userDoc?.accountId as string | undefined;
        const branchId = authState.userDoc?.branchId as string | undefined;
        const unsubBranches = getBranches(setBranches, accountId);
        if (branchId) setSelectedBranchId(branchId);
        return () => { try { unsubBranches(); } catch (e) { /* ignore */ } };
    }, [authState.userDoc?.accountId, authState.userDoc?.branchId]);

    // When branches list loads, set a sensible default for owners (no branch in their user doc)
    useEffect(() => {
        if (!authState.userDoc?.branchId && branches.length > 0 && !selectedBranchId) {
            setSelectedBranchId(branches[0].id);
        }
    }, [branches, authState.userDoc?.branchId, selectedBranchId]);

    // Subscribe to active session only after we know the accountId (avoids queries with undefined filters)
    // Use selectedBranchId as fallback for owners who don't have branchId in their user doc
    useEffect(() => {
        const accountId = authState.userDoc?.accountId as string | undefined;
        const userBranchId = authState.userDoc?.branchId as string | undefined;
        const effectiveBranchId = userBranchId ?? selectedBranchId;
        if (!accountId) return; // wait until accountId is available
        // do not subscribe if we still don't have an effective branch
        if (!effectiveBranchId) return;
        const unsub = getActiveCashRegisterSession(effectiveBranchId, accountId, setActiveSession);
        return () => { try { if (unsub) unsub(); } catch (e) { /* ignore */ } };
    }, [authState.userDoc?.accountId, authState.userDoc?.branchId, selectedBranchId]);

    return (
        <>
            <div className="flex flex-col gap-8">
                 <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Gestión de Caja</h1>
                    {/* Dev simulation buttons removed */}
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
                                    {/* If user has no branch assigned (owner), let them pick one */}
                                    {!authState.userDoc?.branchId && (
                                        <div className="mt-4">
                                            <FormLabel>Sucursal</FormLabel>
                                            <div>
                                                <select value={selectedBranchId || ''} onChange={(e) => setSelectedBranchId(e.target.value)} className="w-full border rounded p-2">
                                                    <option value="">Selecciona una sucursal</option>
                                                    {branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                                                </select>
                                            </div>
                                        </div>
                                    )}
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
                                <CardFooter className="flex flex-col gap-2">
                                <div className="flex gap-2 w-full">
                                    <Button variant="ghost" className="w-1/2" onClick={() => registerMovement(50)}>Registrar Ingreso S/50</Button>
                                    <Button variant="ghost" className="w-1/2" onClick={() => registerMovement(-30)}>Registrar Retiro S/30</Button>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <Input type="number" step="0.01" placeholder="Monto" value={movementAmount ?? ''} onChange={(e) => setMovementAmount(e.target.value ? parseFloat(e.target.value) : null)} className="flex-1" />
                                    <Input placeholder="Motivo (opcional)" value={movementReason} onChange={(e) => setMovementReason(e.target.value)} />
                                    <Button className="ml-2" onClick={() => movementAmount && registerMovement(movementAmount)}>Registrar</Button>
                                </div>
                                <div className="mt-2">
                                    <Button variant="destructive" className="w-full" onClick={handleCloseRegister}>
                                        Cerrar Caja
                                    </Button>
                                </div>
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
