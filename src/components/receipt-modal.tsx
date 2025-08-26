
"use client"

import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from './ui/separator';
import { useReactToPrint } from 'react-to-print';
import { Printer } from 'lucide-react';
import { Sale } from '@/types/sale';

interface ReceiptModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    saleDetails: Sale | null;
}

const ReceiptContent = ({ saleDetails }: { saleDetails: ReceiptModalProps['saleDetails'] }) => {
    if (!saleDetails) return null;
    const { id, items, subtotal, tax, total, discount, paymentMethod } = saleDetails;
    
    return (
        <div className="text-sm font-mono bg-white text-black p-6">
            <div className="text-center space-y-1 mb-6">
                <h3 className="text-lg font-semibold">Ventify</h3>
                <p>Av. Principal 123, Lima, Perú</p>
                <p>RUC: 20123456789</p>
                <p>Tel: (123) 456-7890</p>
                <p>Boleta de Venta Electrónica</p>
            </div>

            <Separator className="my-2 border-dashed border-black" />

            <div className="flex justify-between">
                <span>Nro. Venta:</span>
                <span className="font-bold">{id}</span>
            </div>
            <div className="flex justify-between">
                <span>Fecha:</span>
                <span>{new Date().toLocaleDateString('es-ES')}</span>
            </div>
            <div className="flex justify-between">
                <span>Hora:</span>
                <span>{new Date().toLocaleTimeString('es-ES')}</span>
            </div>
             <div className="flex justify-between">
                <span>Método Pago:</span>
                <span>{paymentMethod}</span>
            </div>
            
            <Separator className="my-2 border-dashed border-black" />
            
            <div>
                <div className="grid grid-cols-5 gap-2 font-bold mb-1">
                    <div className="col-span-2">PRODUCTO</div>
                    <div>CANT.</div>
                    <div>PRECIO</div>
                    <div className="text-right">TOTAL</div>
                </div>
                {items.map(item => (
                    <div key={item.id} className="grid grid-cols-5 gap-2">
                        <div className="col-span-2">{item.name}</div>
                        <div>{item.quantity}</div>
                        <div>S/{item.price.toFixed(2)}</div>
                        <div className="text-right">S/{(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                ))}
            </div>

            <Separator className="my-2 border-dashed border-black" />

            <div className="space-y-1">
                 <div className="flex justify-between">
                    <span className='font-semibold'>SUBTOTAL:</span>
                    <span className='font-semibold'>S/{subtotal.toFixed(2)}</span>
                </div>
                 <div className="flex justify-between">
                    <span className='font-semibold'>DESCUENTO:</span>
                    <span className='font-semibold'>-S/{discount.toFixed(2)}</span>
                </div>
                 <div className="flex justify-between">
                    <span className='font-semibold'>IGV (18%):</span>
                    <span className='font-semibold'>S/{tax.toFixed(2)}</span>
                </div>
                 <div className="flex justify-between text-lg">
                    <span className='font-bold'>TOTAL:</span>
                    <span className='font-bold'>S/{total.toFixed(2)}</span>
                </div>
            </div>

            <Separator className="my-2 border-dashed border-black" />

            <div className="text-center mt-6">
                <p>¡Gracias por su compra!</p>
            </div>
        </div>
    )
}


export function ReceiptModal({ isOpen, onOpenChange, saleDetails }: ReceiptModalProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
      content: () => componentRef.current,
      documentTitle: `Recibo-Venta-${saleDetails?.id}`,
  });
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0">
        <div ref={componentRef}>
            <ReceiptContent saleDetails={saleDetails} />
        </div>
        <DialogFooter className="p-4 bg-background sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={handlePrint} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir Boleta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


    