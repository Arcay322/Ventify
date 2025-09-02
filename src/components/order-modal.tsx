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
import { Printer } from 'lucide-react';
import { Sale } from '@/types/sale';

interface OrderModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    saleDetails: Sale | null;
}

const OrderContent = ({ saleDetails }: { saleDetails: OrderModalProps['saleDetails'] }) => {
    if (!saleDetails) return null;
    const { id, saleNumber, items, subtotal, tax, total, discount, paymentMethod, customerName, customerEmail, customerPhone } = saleDetails;
    
    // Para la orden, calculamos el subtotal como suma directa de productos
    const itemsTotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    
    return (
        <div className="text-sm bg-white text-black p-8">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-2">ORDEN DE COMPRA</h1>
                    <div className="text-sm">
                        <p><strong>Fecha:</strong> {new Date(saleDetails.date).toLocaleDateString('es-ES')}</p>
                        <p><strong>Hora:</strong> {new Date(saleDetails.date).toLocaleTimeString('es-ES')}</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="border-2 border-black p-2 inline-block">
                        <p className="font-bold">TU LOGO</p>
                    </div>
                </div>
            </div>

            {/* Información del Cliente */}
            <div className="border-2 border-black p-4 mb-4">
                <h3 className="font-bold text-sm mb-2">INFORMACIÓN DEL CLIENTE</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p><strong>ORDEN DE COMPRA #:</strong> {saleNumber ? saleNumber.toString() : id.slice(-6)}</p>
                        <p><strong>CUENTA #:</strong> {customerName || 'Cliente General'}</p>
                    </div>
                    <div>
                        {customerEmail && <p><strong>Email:</strong> {customerEmail}</p>}
                        {customerPhone && <p><strong>Teléfono:</strong> {customerPhone}</p>}
                    </div>
                </div>
            </div>

            {/* Información del Proveedor */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="border-2 border-black p-4">
                    <h3 className="font-bold text-sm mb-2">INFORMACIÓN DEL PROVEEDOR</h3>
                    <p><strong>Nombre del vendedor:</strong> Ventify</p>
                    <p><strong>Dirección:</strong> Av. Principal 123</p>
                    <p><strong>Ciudad, Estado, Código postal:</strong> Lima, Perú</p>
                    <p><strong>Contacto:</strong> (123) 456-7890</p>
                </div>
                <div className="border-2 border-black p-4">
                    <h3 className="font-bold text-sm mb-2">ENVIAR A</h3>
                    <p><strong>Nombre de la empresa:</strong> {customerName || 'Cliente General'}</p>
                    <p><strong>Dirección postal:</strong> _______________</p>
                    <p><strong>Ciudad, Estado, Código postal:</strong> _______________</p>
                    <p><strong>Contacto:</strong> {customerPhone || '_______________'}</p>
                </div>
            </div>

            {/* Tabla de Productos */}
            <table className="w-full border-2 border-black mb-6">
                <thead>
                    <tr className="border-b border-black">
                        <th className="border-r border-black p-2 text-left">ARTÍCULO</th>
                        <th className="border-r border-black p-2 text-center">CANT.</th>
                        <th className="border-r border-black p-2 text-left">DESCRIPCIÓN</th>
                        <th className="border-r border-black p-2 text-right">PRECIO</th>
                        <th className="p-2 text-right">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={item.id} className="border-b border-black">
                            <td className="border-r border-black p-2">{index + 1}</td>
                            <td className="border-r border-black p-2 text-center">{item.quantity}</td>
                            <td className="border-r border-black p-2">{item.name}</td>
                            <td className="border-r border-black p-2 text-right">S/{item.price.toFixed(2)}</td>
                            <td className="p-2 text-right">S/{(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                    {/* Filas vacías para completar el formato */}
                    {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, index) => (
                        <tr key={`empty-${index}`} className="border-b border-black">
                            <td className="border-r border-black p-2 h-8">&nbsp;</td>
                            <td className="border-r border-black p-2">&nbsp;</td>
                            <td className="border-r border-black p-2">&nbsp;</td>
                            <td className="border-r border-black p-2">&nbsp;</td>
                            <td className="p-2">&nbsp;</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Footer con comentarios y totales */}
            <div className="grid grid-cols-2 gap-4">
                <div className="border-2 border-black p-4">
                    <h3 className="font-bold text-sm mb-2">COMENTARIO O NOTA ESPECIAL</h3>
                    <div className="min-h-[100px]">
                        <p className="text-xs">Forma de Pago: {paymentMethod}</p>
                        <p className="text-xs mt-2">Este documento constituye una orden de pedido.</p>
                        <p className="text-xs">Válido como constancia de la transacción realizada.</p>
                    </div>
                </div>
                <div className="border-2 border-black p-4">
                    <div className="space-y-2">
                        <div className="flex justify-between border-b pb-1">
                            <span className="font-bold">SUB TOTAL</span>
                            <span>S/{itemsTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                            <span className="font-bold">DESCUENTO</span>
                            <span>-S/{discount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                            <span className="font-bold">IMPUESTO</span>
                            <span>Incluido</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold">
                            <span>TOTAL GENERAL</span>
                            <span>S/{total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pie de página */}
            <div className="text-center mt-6 text-xs">
                <p>¡Gracias por su preferencia!</p>
            </div>
        </div>
    )
}

export function OrderModal({ isOpen, onOpenChange, saleDetails }: OrderModalProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
      content: () => componentRef.current,
      documentTitle: `Orden-Compra-${saleDetails?.id}`,
  });
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0" aria-describedby="order-description">
        <DialogTitle className="sr-only">Orden de Compra</DialogTitle>
        <DialogDescription id="order-description" className="sr-only">
          Orden de compra formal detallada de la venta realizada con opciones para imprimir
        </DialogDescription>
        <div ref={componentRef}>
            <OrderContent saleDetails={saleDetails} />
        </div>
        <DialogFooter className="p-4 bg-background sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={handlePrint} style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir Orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
