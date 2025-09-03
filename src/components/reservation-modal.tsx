"use client"

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ReservationService } from '@/services/reservation-service';
import { ReservationDepositService } from '@/services/reservation-deposit-service';
import { StockReservationService } from '@/services/stock-reservation-service';
import { Reservation } from '@/types/reservation';
import { Sale } from '@/types/sale';
import { CustomerSelector } from './customer-selector';
import { Customer } from '@/types/customer';
import { useAuth } from '@/hooks/use-auth';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock, User, Phone, Mail, FileText, DollarSign } from 'lucide-react';
import Image from 'next/image';

interface ReservationModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    saleData: {
        cart: any[];
        total: number;
        subtotal: number;
        tax: number;
        discount: number;
        selectedBranch: string;
    } | null;
    onReservationCreated: (reservation: Reservation) => void;
}

export function ReservationModal({ 
    isOpen, 
    onOpenChange, 
    saleData, 
    onReservationCreated 
}: ReservationModalProps) {
    const { toast } = useToast();
    const authState = useAuth();
    const [isCreating, setIsCreating] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [notes, setNotes] = useState('');
    const [reservationDays, setReservationDays] = useState(7);
    const [depositAmount, setDepositAmount] = useState<number>(0);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedCustomer(null);
            setCustomerName('');
            setCustomerPhone('');
            setCustomerEmail('');
            setNotes('');
            setReservationDays(7);
            setDepositAmount(0);
        }
    }, [isOpen]);

    // Update customer fields when selectedCustomer changes
    useEffect(() => {
        if (selectedCustomer) {
            setCustomerName(selectedCustomer.name);
            setCustomerPhone(selectedCustomer.phone || '');
            setCustomerEmail(selectedCustomer.email || '');
        }
    }, [selectedCustomer]);

    const handleCreateReservation = async () => {
        if (!saleData) return;

        // Validaciones
        if (!customerName.trim()) {
            toast({
                title: "Campo requerido",
                description: "El nombre del cliente es obligatorio para crear una reserva",
                variant: "destructive"
            });
            return;
        }

        if (!customerPhone.trim() && !customerEmail.trim()) {
            toast({
                title: "Contacto requerido",
                description: "Debes proporcionar al menos un teléfono o email del cliente",
                variant: "destructive"
            });
            return;
        }

        if (reservationDays < 1 || reservationDays > 30) {
            toast({
                title: "Días inválidos",
                description: "Los días de reserva deben estar entre 1 y 30",
                variant: "destructive"
            });
            return;
        }

        if (depositAmount < 0 || depositAmount > saleData.total) {
            toast({
                title: "Depósito inválido",
                description: `El depósito debe estar entre S/0.00 y S/${saleData.total.toFixed(2)}`,
                variant: "destructive"
            });
            return;
        }

        // Validar stock disponible antes de crear la reserva
        const stockItems = saleData.cart.map(item => ({
            productId: item.id,
            quantity: item.quantity,
            branchId: saleData.selectedBranch
        }));

        const stockCheck = StockReservationService.canReserveStock(stockItems, saleData.cart);
        if (!stockCheck.canReserve) {
            toast({
                title: "Stock insuficiente",
                description: `No hay suficiente stock disponible: ${stockCheck.errors.join('; ')}`,
                variant: "destructive"
            });
            return;
        }

        setIsCreating(true);

        try {
            const expiryDate = Date.now() + (reservationDays * 24 * 60 * 60 * 1000);
            
            const reservationData: any = {
                items: saleData.cart.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    sku: item.sku,
                    ...(item.originalPrice !== undefined && { originalPrice: item.originalPrice }),
                    ...(item.modifiedPrice !== undefined && { modifiedPrice: item.modifiedPrice }),
                    ...(item.priceModifiedBy && { priceModifiedBy: item.priceModifiedBy }),
                    ...(item.priceModificationReason && { priceModificationReason: item.priceModificationReason }),
                    ...(item.category && { category: item.category }),
                    ...(item.costPrice !== undefined && { costPrice: item.costPrice }),
                    ...(item.stock && { stock: item.stock }),
                    ...(item.imageUrl && { imageUrl: item.imageUrl }),
                    ...(item.hint && { hint: item.hint })
                })),
                subtotal: saleData.subtotal,
                discount: saleData.discount,
                tax: saleData.tax,
                total: saleData.total,
                branchId: saleData.selectedBranch,
                createdBy: authState.user?.uid || '',
                customerName: customerName.trim(),
                reservationDays,
                expiryDate,
                accountId: authState.userDoc?.accountId
            };

            // Solo agregar campos opcionales si tienen valor
            if (customerPhone.trim()) {
                reservationData.customerPhone = customerPhone.trim();
            }
            if (customerEmail.trim()) {
                reservationData.customerEmail = customerEmail.trim();
            }
            if (selectedCustomer?.id) {
                reservationData.customerId = selectedCustomer.id;
            }
            if (notes.trim()) {
                reservationData.notes = notes.trim();
            }
            if (depositAmount > 0) {
                reservationData.depositAmount = depositAmount;
            }

            const result = await ReservationService.createReservation(reservationData);
            
            // Si hay depósito, registrarlo separadamente en el sistema contable
            if (depositAmount > 0) {
                await ReservationDepositService.recordReservationDeposit(
                    result.id,
                    result.reservationNumber,
                    depositAmount,
                    paymentMethod,
                    customerName,
                    saleData.branchId,
                    saleData.accountId,
                    saleData.createdBy
                );
                
                toast({
                    title: "Reserva creada exitosamente",
                    description: `Reserva #${result.reservationNumber} creada con adelanto de S/${depositAmount.toFixed(2)}. Stock reservado automáticamente.`,
                });
            } else {
                toast({
                    title: "Reserva creada exitosamente", 
                    description: `Reserva #${result.reservationNumber} creada para ${customerName}. Stock reservado automáticamente.`,
                });
            }

            onReservationCreated(result);
            onOpenChange(false);
            
        } catch (error) {
            console.error('Error creating reservation:', error);
            toast({
                title: "Error al crear reserva",
                description: error instanceof Error ? error.message : "No se pudo crear la reserva",
                variant: "destructive"
            });
        } finally {
            setIsCreating(false);
        }
    };

    if (!saleData) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Crear Reserva de Pedido
                    </DialogTitle>
                    <DialogDescription>
                        El cliente podrá recoger y pagar este pedido dentro del tiempo establecido
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Resumen del pedido */}
                    <div className="border rounded-lg p-4 bg-muted/50">
                        <h3 className="font-semibold mb-3">Resumen del Pedido</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {saleData.cart.map((item, index) => (
                                <div key={item.id || index} className="flex items-center gap-3 text-sm">
                                    {item.imageUrl ? (
                                        <Image src={item.imageUrl} alt={item.name} width={32} height={32} className="rounded" />
                                    ) : (
                                        <div className="w-8 h-8 bg-muted rounded" />
                                    )}
                                    <div className="flex-1">
                                        <span className="font-medium">{item.name}</span>
                                        <span className="text-muted-foreground ml-2">
                                            {item.quantity}x S/{item.price.toFixed(2)}
                                        </span>
                                    </div>
                                    <span className="font-semibold">
                                        S/{(item.price * item.quantity).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <Separator className="my-3" />
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span>Subtotal:</span>
                                <span>S/{saleData.subtotal.toFixed(2)}</span>
                            </div>
                            {saleData.discount > 0 && (
                                <div className="flex justify-between text-red-600">
                                    <span>Descuento:</span>
                                    <span>-S/{saleData.discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-semibold text-base border-t pt-1">
                                <span>Total:</span>
                                <span>S/{saleData.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Información del cliente */}
                    <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Información del Cliente
                        </h3>
                        
                        <CustomerSelector 
                            selectedCustomer={selectedCustomer}
                            onCustomerSelect={setSelectedCustomer}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="customerName">Nombre completo *</Label>
                                <Input
                                    id="customerName"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    placeholder="Nombre del cliente"
                                />
                            </div>
                            <div>
                                <Label htmlFor="customerPhone" className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    Teléfono
                                </Label>
                                <Input
                                    id="customerPhone"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    placeholder="Número de teléfono"
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="customerEmail" className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                Email (opcional)
                            </Label>
                            <Input
                                id="customerEmail"
                                type="email"
                                value={customerEmail}
                                onChange={(e) => setCustomerEmail(e.target.value)}
                                placeholder="correo@ejemplo.com"
                            />
                        </div>
                    </div>

                    {/* Configuración de la reserva */}
                    <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Configuración de la Reserva
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="reservationDays">Días de reserva</Label>
                                <Input
                                    id="reservationDays"
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={reservationDays}
                                    onChange={(e) => setReservationDays(parseInt(e.target.value) || 7)}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Vence: {new Date(Date.now() + (reservationDays * 24 * 60 * 60 * 1000)).toLocaleDateString('es-PE')}
                                </p>
                            </div>
                            <div>
                                <Label htmlFor="depositAmount" className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    Depósito/Anticipo (opcional)
                                </Label>
                                <Input
                                    id="depositAmount"
                                    type="number"
                                    min="0"
                                    max={saleData.total}
                                    step="0.01"
                                    value={depositAmount || ''}
                                    onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Máximo: S/{saleData.total.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="notes" className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                Notas adicionales
                            </Label>
                            <Textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Notas sobre la reserva, instrucciones especiales, etc."
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleCreateReservation} disabled={isCreating}>
                        {isCreating ? 'Creando reserva...' : 'Crear Reserva'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
