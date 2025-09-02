
"use client"

import { useRef, useState } from 'react';
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
import { Printer, FileText, Receipt } from 'lucide-react';
import { Sale } from '@/types/sale';
import { OrderModal } from './order-modal';

interface ReceiptModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    saleDetails: Sale | null;
}

const ReceiptContent = ({ saleDetails }: { saleDetails: ReceiptModalProps['saleDetails'] }) => {
    if (!saleDetails) return null;
    const { id, saleNumber, items, subtotal, tax, total, discount, paymentMethod, customerName, customerEmail, customerPhone } = saleDetails;
    
    // Para la nota de pedido, calculamos el subtotal como suma directa de productos
    const itemsTotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    
    return (
        <div className="text-sm font-mono bg-white text-black p-6">
            <div className="text-center space-y-1 mb-6">
                <h3 className="text-lg font-semibold">Ventify</h3>
                <p>Av. Principal 123, Lima, Perú</p>
                <p>RUC: 20123456789</p>
                <p>Tel: (123) 456-7890</p>
                <p className="font-bold text-base">NOTA DE PEDIDO</p>
            </div>

            <Separator className="my-2 border-dashed border-black" />

            <div className="flex justify-between">
                <span>Nro. Pedido:</span>
                <span className="font-bold">{saleNumber ? saleNumber.toString() : id.slice(-6)}</span>
            </div>
            <div className="flex justify-between">
                <span>Fecha:</span>
                <span>{new Date(saleDetails.date).toLocaleDateString('es-ES')}</span>
            </div>
            <div className="flex justify-between">
                <span>Hora:</span>
                <span>{new Date(saleDetails.date).toLocaleTimeString('es-ES')}</span>
            </div>
             <div className="flex justify-between">
                <span>Forma de Pago:</span>
                <span>{paymentMethod}</span>
            </div>
            
            {customerName && (
                <>
                    <Separator className="my-2 border-dashed border-black" />
                    <div className="text-center">
                        <div className="font-semibold">CLIENTE</div>
                        <div>{customerName}</div>
                        {customerEmail && <div>{customerEmail}</div>}
                        {customerPhone && <div>{customerPhone}</div>}
                    </div>
                </>
            )}
            
            <Separator className="my-2 border-dashed border-black" />
            
            <div>
                <div className="grid grid-cols-5 gap-2 font-bold mb-1">
                    <div className="col-span-2">PRODUCTO</div>
                    <div>CANT.</div>
                    <div>PRECIO</div>
                    <div className="text-right">TOTAL</div>
                </div>
                {items.map(item => (
                    <div key={item.id}>
                        <div className="grid grid-cols-5 gap-2">
                            <div className="col-span-2">{item.name}</div>
                            <div>{item.quantity}</div>
                            <div>S/{item.price.toFixed(2)}</div>
                            <div className="text-right">S/{(item.price * item.quantity).toFixed(2)}</div>
                        </div>
                        {(item as any).modifiedPrice && (
                            <div className="text-xs text-center">
                                (Precio original: S/{((item as any).originalPrice || item.price).toFixed(2)})
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Separator className="my-2 border-dashed border-black" />

            <div className="space-y-1">
                 <div className="flex justify-between">
                    <span className='font-semibold'>SUBTOTAL:</span>
                    <span className='font-semibold'>S/{itemsTotal.toFixed(2)}</span>
                </div>
                 <div className="flex justify-between">
                    <span className='font-semibold'>DESCUENTO:</span>
                    <span className='font-semibold'>-S/{discount.toFixed(2)}</span>
                </div>
                 <div className="flex justify-between text-lg">
                    <span className='font-bold'>TOTAL A PAGAR:</span>
                    <span className='font-bold'>S/{total.toFixed(2)}</span>
                </div>
            </div>

            <Separator className="my-2 border-dashed border-black" />

            <div className="text-center mt-6">
                <p className="text-xs">NOTA: Este documento no constituye comprobante fiscal.</p>
                <p className="text-xs">Válido únicamente como constancia del pedido realizado.</p>
                <p className="mt-2">¡Gracias por su preferencia!</p>
            </div>
        </div>
    )
}


export function ReceiptModal({ isOpen, onOpenChange, saleDetails }: ReceiptModalProps) {
  const componentRef = useRef<HTMLDivElement>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const handlePrintReceipt = useReactToPrint({
      content: () => componentRef.current,
      documentTitle: `Nota-Pedido-${saleDetails?.id}`,
  });

  const openOrderModal = () => {
    onOpenChange(false); // Cerrar modal actual
    setIsOrderModalOpen(true); // Abrir modal de orden
  };
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-0" aria-describedby="receipt-description">
          <DialogTitle className="sr-only">Nota de Pedido</DialogTitle>
          <DialogDescription id="receipt-description" className="sr-only">
            Nota de pedido detallada de la venta realizada con opciones para imprimir
          </DialogDescription>
          <div ref={componentRef}>
              <ReceiptContent saleDetails={saleDetails} />
          </div>
          <DialogFooter className="p-4 bg-background flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={handlePrintReceipt} variant="default" className="flex-1 sm:flex-initial">
                <Receipt className="mr-2 h-4 w-4" />
                Nota Simple
              </Button>
              <Button onClick={openOrderModal} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }} className="flex-1 sm:flex-initial">
                <FileText className="mr-2 h-4 w-4" />
                Orden Formal
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Orden de Compra */}
      <OrderModal 
        isOpen={isOrderModalOpen} 
        onOpenChange={setIsOrderModalOpen} 
        saleDetails={saleDetails} 
      />
    </>
  );
}


    