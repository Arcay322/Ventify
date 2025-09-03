"use client"

import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from './ui/separator';
import { useReactToPrint } from 'react-to-print';
import { Printer, Calendar } from 'lucide-react';
import { Reservation } from '@/types/reservation';

interface ReservationReceiptModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    reservationDetails: Reservation | null;
}

const ReservationReceiptContent = ({ reservationDetails }: { reservationDetails: ReservationReceiptModalProps['reservationDetails'] }) => {
    if (!reservationDetails) return null;
    
    // Usar destructuring directo como en la nota de pedido
    const { 
        id,
        reservationNumber, 
        items = [], // Valor por defecto para evitar undefined
        subtotal,
        discount,
        total,
        depositAmount,
        customerName,
        customerEmail, 
        customerPhone,
        date,
        expiryDate,
        reservationDays,
        notes
    } = reservationDetails;
    
    // Calcular subtotal desde los items como en la nota de pedido (con verificación)
    const itemsTotal = items && items.length > 0 ? items.reduce((acc, item) => acc + item.price * item.quantity, 0) : 0;
    const remainingAmount = total - (depositAmount || 0);
    
    return (
        <div className="text-sm font-mono bg-white text-black p-6">
            <div className="text-center space-y-1 mb-6">
                <h3 className="text-lg font-semibold">Ventify</h3>
                <p>Av. Principal 123, Lima, Perú</p>
                <p>RUC: 20123456789</p>
                <p>Tel: (123) 456-7890</p>
                <p className="font-bold text-base text-blue-800">COMPROBANTE DE RESERVA</p>
            </div>

            <Separator className="my-2 border-dashed border-black" />

            {/* Información de la Reserva */}
            <div className="space-y-1 mb-4">
                <div className="flex justify-between">
                    <span>Nro. Reserva:</span>
                    <span className="font-bold">#{reservationNumber ? reservationNumber.toString() : (id ? id.slice(-6) : 'N/A')}</span>
                </div>
                <div className="flex justify-between">
                    <span>Fecha de Reserva:</span>
                    <span>{date ? new Date(date).toLocaleDateString('es-ES') : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                    <span>Hora de Reserva:</span>
                    <span>{date ? new Date(date).toLocaleTimeString('es-ES') : 'N/A'}</span>
                </div>
                {expiryDate && (
                    <div className="flex justify-between">
                        <span>Válida hasta:</span>
                        <span className="font-semibold text-red-700">
                            {new Date(expiryDate).toLocaleDateString('es-ES')}
                        </span>
                    </div>
                )}
                {reservationDays && (
                    <div className="flex justify-between">
                        <span>Vigencia:</span>
                        <span>{reservationDays} días</span>
                    </div>
                )}
            </div>

            {/* Información del Cliente */}
            {customerName && (
                <>
                    <Separator className="my-2 border-dashed border-black" />
                    <div className="text-center mb-4">
                        <div className="font-semibold">CLIENTE</div>
                        <div className="font-medium">{customerName}</div>
                        {customerEmail && <div>{customerEmail}</div>}
                        {customerPhone && <div>{customerPhone}</div>}
                    </div>
                </>
            )}

            <Separator className="my-2 border-dashed border-black" />
            
            {/* Productos Reservados */}
            <div className="mb-4">
                <div className="grid grid-cols-5 gap-2 font-bold mb-1">
                    <div className="col-span-2">PRODUCTO</div>
                    <div>CANT.</div>
                    <div>PRECIO</div>
                    <div className="text-right">TOTAL</div>
                </div>
                {items && items.length > 0 ? items.map((item, index) => (
                    <div key={index}>
                        <div className="grid grid-cols-5 gap-2">
                            <div className="col-span-2">{item.name || 'Sin nombre'}</div>
                            <div>{item.quantity || 0}</div>
                            <div>S/{(item.price || 0).toFixed(2)}</div>
                            <div className="text-right">S/{((item.price || 0) * (item.quantity || 0)).toFixed(2)}</div>
                        </div>
                        {(item as any).modifiedPrice && (
                            <div className="text-xs text-center">
                                (Precio original: S/{((item as any).originalPrice || item.price || 0).toFixed(2)})
                            </div>
                        )}
                    </div>
                )) : (
                    <div className="text-center text-gray-500 py-4">
                        No hay productos en esta reserva
                    </div>
                )}
            </div>

            <Separator className="my-2 border-dashed border-black" />

            {/* Totales */}
            <div className="space-y-1 mb-4">
                <div className="flex justify-between">
                    <span className="font-semibold">SUBTOTAL:</span>
                    <span className="font-semibold">S/{itemsTotal.toFixed(2)}</span>
                </div>
                {(discount || 0) > 0 && (
                    <div className="flex justify-between">
                        <span className="font-semibold">DESCUENTO:</span>
                        <span className="font-semibold">-S/{(discount || 0).toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between text-lg border-t pt-1">
                    <span className="font-bold">TOTAL DE LA RESERVA:</span>
                    <span className="font-bold">S/{(total || 0).toFixed(2)}</span>
                </div>
            </div>

            <Separator className="my-2 border-dashed border-black" />

            {/* Estado de Pago */}
            <div className="mb-4">
                <p className="font-semibold text-center mb-2">ESTADO DE PAGO</p>
                {depositAmount && depositAmount > 0 ? (
                    <div className="space-y-2">
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                            <div className="flex justify-between items-center">
                                <span className="text-green-700 font-medium">✓ Adelanto Pagado:</span>
                                <span className="text-green-700 font-bold">S/{depositAmount.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded p-3">
                            <div className="flex justify-between items-center">
                                <span className="text-orange-700 font-medium">⏳ Saldo Pendiente:</span>
                                <span className="text-orange-700 font-bold text-lg">S/{remainingAmount.toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-orange-600 mt-1 text-center">
                                A pagar al momento de recoger
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <div className="flex justify-between items-center">
                            <span className="text-yellow-700 font-medium">💰 Total a Pagar:</span>
                            <span className="text-yellow-700 font-bold text-lg">S/{(total || 0).toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-yellow-600 mt-1 text-center">
                            Pago completo al recoger la reserva
                        </p>
                    </div>
                )}
            </div>

            {/* Notas adicionales */}
            {notes && (
                <div className="mb-4">
                    <p className="font-semibold mb-1">NOTAS:</p>
                    <p className="text-xs bg-gray-50 p-2 rounded">{notes}</p>
                </div>
            )}

            <Separator className="my-2 border-dashed border-black" />

            {/* Términos y Condiciones */}
            <div className="text-xs text-center space-y-1 mt-4">
                <p className="font-semibold">TÉRMINOS Y CONDICIONES</p>
                <p>• Presente este comprobante para recoger su pedido</p>
                <p>• La reserva es válida hasta la fecha indicada arriba</p>
                {depositAmount && depositAmount > 0 ? (
                    <>
                        <p>• El adelanto pagado NO es reembolsable</p>
                        <p>• Complete el saldo restante al momento de recoger</p>
                    </>
                ) : (
                    <p>• Realice el pago completo al momento de recoger</p>
                )}
                <p>• Verifique disponibilidad antes de su visita</p>
                <p className="font-semibold text-red-600">• Reserva vencida = pérdida del adelanto</p>
            </div>

            <div className="text-center mt-4 text-xs">
                <p>¡Gracias por su preferencia!</p>
                <p>Para consultas: WhatsApp (123) 456-7890</p>
            </div>
        </div>
    );
};

export function ReservationReceiptModal({ isOpen, onOpenChange, reservationDetails }: ReservationReceiptModalProps) {
    const receiptRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        content: () => receiptRef.current,
        documentTitle: `Reserva-${reservationDetails?.reservationNumber ? reservationDetails.reservationNumber : reservationDetails?.id.slice(-6)}`,
    });

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        Comprobante de Reserva
                    </DialogTitle>
                    <DialogDescription>
                        Comprobante para el cliente de la reserva #{reservationDetails?.reservationNumber}
                    </DialogDescription>

                    <div ref={receiptRef}>
                        <ReservationReceiptContent reservationDetails={reservationDetails} />
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cerrar
                        </Button>
                        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}