"use client"

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, Download, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getUserDoc } from '@/services/auth-service';
import { getBranchById } from '@/services/branch-service';

interface CashRegisterReportProps {
  reportData: any;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CashRegisterReport({ reportData, isOpen, onOpenChange }: CashRegisterReportProps) {
  if (!reportData) return null;

  const session = reportData.sessionSnapshot;
  const movements = reportData.movements || [];
  const salesSummary = reportData.salesSummary || {};
  const [cashierName, setCashierName] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (session?.startedBy) {
          const user = await getUserDoc(session.startedBy);
          if (mounted) setCashierName(user?.displayName || null);
        }
        if (session?.branchId) {
          const branch = await getBranchById(session.branchId);
          if (mounted) setBranchName(branch?.name || null);
        }
      } catch (e) {
        // ignore lookup failures
      }
    })();
    return () => { mounted = false; };
  }, [session?.startedBy, session?.branchId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const reportContent = generateReportContent();
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cierre-Z-${session?.id || 'report'}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateReportContent = () => {
    const startTime = session?.openTime ? format(new Date(session.openTime.seconds * 1000), 'PPP p', { locale: es }) : 'N/A';
    const endTime = reportData?.createdAt ? format(new Date(reportData.createdAt.seconds * 1000), 'PPP p', { locale: es }) : 'N/A';
    
    return `
==========================================
           REPORTE DE CIERRE Z
==========================================

INFORMACIÓN DEL TURNO:
- ID de Sesión: ${session?.id || 'N/A'}
  - Cajero: ${cashierName || session?.startedBy || 'N/A'}
  - Sucursal: ${branchName || session?.branchId || 'N/A'}
- Fecha/Hora Apertura: ${startTime}
- Fecha/Hora Cierre: ${endTime}

==========================================
           RESUMEN FINANCIERO
==========================================

EFECTIVO:
- Monto Inicial: S/${(session?.initialAmount || 0).toFixed(2)}
- Ventas en Efectivo: S/${(session?.cashSales || 0).toFixed(2)}
- Otros Ingresos: S/${movements.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0).toFixed(2)}
- Retiros: S/${Math.abs(movements.filter(m => m.amount < 0).reduce((s, m) => s + m.amount, 0)).toFixed(2)}
- Total Esperado: S/${(reportData?.expectedAmount || 0).toFixed(2)}
- Total Contado: S/${(reportData?.countedAmount || 0).toFixed(2)}
- Diferencia: S/${(reportData?.difference || 0).toFixed(2)} ${(reportData?.difference || 0) >= 0 ? '(Sobrante)' : '(Faltante)'}

OTRAS VENTAS:
- Ventas con Tarjeta: S/${(session?.cardSales || 0).toFixed(2)}
- Ventas Digitales: S/${(session?.digitalSales || 0).toFixed(2)}
- Total Ventas: S/${(session?.totalSales || 0).toFixed(2)}

==========================================
        MOVIMIENTOS DE EFECTIVO
==========================================

${movements.length === 0 ? 'No hay movimientos registrados.' : movements.map(m => 
  `${format(new Date(m.createdAt?.seconds * 1000 || Date.now()), 'HH:mm:ss')} - ${m.reason || (m.amount > 0 ? 'Ingreso' : 'Retiro')}: S/${m.amount.toFixed(2)}`
).join('\n')}

==========================================
              RESUMEN DE VENTAS
==========================================

- Número de Ventas: ${salesSummary?.totalTransactions || 0}
- Ticket Promedio: S/${salesSummary?.averageTicket?.toFixed(2) || '0.00'}

==========================================

Reporte generado el: ${format(new Date(), 'PPP p', { locale: es })}
Sistema: Ventify POS
    `.trim();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="print:hidden">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Reporte de Cierre Z</DialogTitle>
              <DialogDescription>
                Sesión: {session?.id} - Cerrada el {reportData?.createdAt ? 
                  format(new Date(reportData.createdAt.seconds * 1000), 'PPP p', { locale: es }) : 'N/A'}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 print:space-y-4" id="report-content">
          {/* Header del reporte para impresión */}
          <div className="hidden print:block text-center border-b pb-4">
            <h1 className="text-2xl font-bold">REPORTE DE CIERRE Z</h1>
            <p className="text-sm text-muted-foreground mt-2">
              {format(new Date(), 'PPP p', { locale: es })}
            </p>
          </div>

          {/* Información del Turno */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información del Turno</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID de Sesión:</span>
                  <span className="font-mono">{session?.id || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cajero:</span>
                  <span>{cashierName || session?.startedBy || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sucursal:</span>
                  <span>{branchName || session?.branchId || 'N/A'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hora Apertura:</span>
                  <span>{session?.openTime ? format(new Date(session.openTime.seconds * 1000), 'HH:mm:ss') : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hora Cierre:</span>
                  <span>{reportData?.createdAt ? format(new Date(reportData.createdAt.seconds * 1000), 'HH:mm:ss') : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duración:</span>
                  <span>
                    {session?.openTime && reportData?.createdAt ? 
                      `${Math.floor((reportData.createdAt.seconds - session.openTime.seconds) / 3600)}h ${Math.floor(((reportData.createdAt.seconds - session.openTime.seconds) % 3600) / 60)}m` 
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumen Financiero */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumen Financiero</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Efectivo */}
                <div>
                  <h4 className="font-semibold mb-2">Movimiento de Efectivo</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monto Inicial:</span>
                      <span>S/{(session?.initialAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ventas en Efectivo:</span>
                      <span className="text-green-600">+ S/{(session?.cashSales || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Otros Ingresos:</span>
                      <span className="text-green-600">+ S/{movements.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Retiros:</span>
                      <span className="text-red-600">- S/{Math.abs(movements.filter(m => m.amount < 0).reduce((s, m) => s + m.amount, 0)).toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total Esperado:</span>
                      <span>S/{(reportData?.expectedAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total Contado:</span>
                      <span>S/{(reportData?.countedAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between font-bold text-lg ${(reportData?.difference || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      <span>Diferencia:</span>
                      <span>
                        {(reportData?.difference || 0) >= 0 ? '+' : ''}S/{(reportData?.difference || 0).toFixed(2)}
                        <span className="text-sm ml-1">
                          {(reportData?.difference || 0) >= 0 ? '(Sobrante)' : '(Faltante)'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Otras Ventas */}
                <div>
                  <h4 className="font-semibold mb-2">Resumen de Ventas por Método de Pago</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ventas en Efectivo:</span>
                      <span>S/{(session?.cashSales || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ventas con Tarjeta:</span>
                      <span>S/{(session?.cardSales || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ventas Digitales:</span>
                      <span>S/{(session?.digitalSales || 0).toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total Ventas:</span>
                      <span>S/{(session?.totalSales || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Movimientos de Efectivo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Movimientos de Efectivo Registrados</CardTitle>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No hay movimientos registrados.</p>
              ) : (
                <div className="space-y-2">
                  {movements.map((movement, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                      <div>
                        <div className="font-medium">{movement.reason || (movement.amount > 0 ? 'Ingreso' : 'Retiro')}</div>
                        <div className="text-sm text-muted-foreground">
                          {movement.createdAt ? format(new Date(movement.createdAt.seconds * 1000), 'HH:mm:ss') : 'N/A'}
                        </div>
                      </div>
                      <div className={`font-semibold ${movement.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {movement.amount >= 0 ? '+' : ''}S/{movement.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <style jsx>{`
          @media print {
            .print\\:hidden { display: none !important; }
            .print\\:block { display: block !important; }
            .print\\:space-y-4 > * + * { margin-top: 1rem !important; }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
