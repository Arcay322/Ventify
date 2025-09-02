"use client"

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  ArrowRight, 
  Calendar, 
  User, 
  Package, 
  CheckCircle, 
  Clock, 
  Truck, 
  XCircle, 
  AlertCircle,
  Loader2,
  FileText,
  Building
} from 'lucide-react';
import { Transfer, UpdateTransferStatusRequest } from '@/types/transfer';
import { TransferService } from '@/services/transfer-service';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';

interface TransferDetailsModalProps {
  transfer: Transfer | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdate: (transferId: string, status: string) => void;
}

export function TransferDetailsModal({ 
  transfer, 
  isOpen,
  onOpenChange,
  onStatusUpdate
}: TransferDetailsModalProps) {
  const { authState } = useAuth();
  const { canApproveTransfer, canManageTransfers } = usePermissions();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  if (!transfer) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'in_transit':
        return <Truck className="h-5 w-5 text-purple-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: 'Pendiente',
      approved: 'Aprobada',
      in_transit: 'En tránsito',
      completed: 'Completada',
      cancelled: 'Cancelada'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getReasonLabel = (reason: string) => {
    const labels = {
      out_of_stock: 'Sin stock',
      restock: 'Reabastecimiento',
      customer_request: 'Solicitud de cliente',
      other: 'Otro'
    };
    return labels[reason as keyof typeof labels] || reason;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      setLoading(true);

      const request: UpdateTransferStatusRequest = {
        transferId: transfer.id,
        status: newStatus as any,
        notes: notes.trim() || undefined
      };

      await TransferService.updateTransferStatus(request, authState.userDoc!);

      toast({
        title: "Estado actualizado",
        description: `La transferencia ha sido marcada como "${getStatusLabel(newStatus)}"`
      });

      onStatusUpdate(transfer.id, newStatus);
      setNotes('');
    } catch (error) {
      console.error('Error updating transfer status:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al actualizar el estado",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getAvailableActions = () => {
    if (!canManageInventory) return [];

    switch (transfer.status) {
      case 'pending':
        return [
          { status: 'approved', label: 'Aprobar', variant: 'default' as const },
          { status: 'cancelled', label: 'Cancelar', variant: 'destructive' as const }
        ];
      case 'approved':
        return [
          { status: 'in_transit', label: 'Marcar en tránsito', variant: 'default' as const },
          { status: 'cancelled', label: 'Cancelar', variant: 'destructive' as const }
        ];
      case 'in_transit':
        return [
          { status: 'completed', label: 'Marcar como recibida', variant: 'default' as const },
          { status: 'cancelled', label: 'Cancelar', variant: 'destructive' as const }
        ];
      default:
        return [];
    }
  };

  const availableActions = getAvailableActions();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-3">
                {getStatusIcon(transfer.status)}
                {transfer.transferNumber}
              </DialogTitle>
              <p className="text-muted-foreground">
                Creada el {formatDate(transfer.requestedAt)}
              </p>
            </div>
            <Badge variant="outline" className="flex items-center gap-2">
              {getStatusIcon(transfer.status)}
              {getStatusLabel(transfer.status)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Información de sucursales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Sucursales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className="font-semibold text-lg">{transfer.fromBranchName}</div>
                  <div className="text-muted-foreground">Origen</div>
                </div>
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
                <div className="text-center">
                  <div className="font-semibold text-lg">{transfer.toBranchName}</div>
                  <div className="text-muted-foreground">Destino</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información general */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Solicitado por:</span>
                    <span className="font-medium">{transfer.requestedByName}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Razón:</span>
                    <span className="font-medium">{getReasonLabel(transfer.reason)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Total productos:</span>
                    <span className="font-medium">{transfer.totalItems} unidades</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Solicitada:</span>
                    <span className="font-medium">{formatDate(transfer.requestedAt)}</span>
                  </div>
                  
                  {transfer.approvedAt && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                      <span className="text-muted-foreground">Aprobada:</span>
                      <span className="font-medium">{formatDate(transfer.approvedAt)}</span>
                    </div>
                  )}
                  
                  {transfer.sentAt && (
                    <div className="flex items-center gap-2 text-sm">
                      <Truck className="h-4 w-4 text-purple-500" />
                      <span className="text-muted-foreground">Enviada:</span>
                      <span className="font-medium">{formatDate(transfer.sentAt)}</span>
                    </div>
                  )}
                  
                  {transfer.receivedAt && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-muted-foreground">Recibida:</span>
                      <span className="font-medium">{formatDate(transfer.receivedAt)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Productos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Productos ({transfer.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {transfer.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-sm text-muted-foreground">SKU: {item.productSku}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{item.requestedQuantity} unidades</div>
                      {item.unitPrice && (
                        <div className="text-sm text-muted-foreground">
                          ${item.unitPrice} c/u
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notas */}
          {transfer.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{transfer.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Acciones disponibles */}
          {availableActions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="actionNotes">Notas para la acción (opcional)</Label>
                  <Textarea
                    id="actionNotes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Agregar información adicional sobre esta acción..."
                    rows={2}
                  />
                </div>
                
                <div className="flex gap-2">
                  {availableActions.map(action => (
                    <Button
                      key={action.status}
                      variant={action.variant}
                      onClick={() => handleStatusUpdate(action.status)}
                      disabled={loading}
                    >
                      {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {action.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="border-t pt-4 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
