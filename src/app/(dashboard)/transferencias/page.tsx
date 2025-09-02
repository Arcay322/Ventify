"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  Filter,
  ArrowRight,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { Transfer } from '@/types/transfer';
import { TransferService } from '@/services/transfer-service';
import { CreateTransferModal } from '@/components/create-transfer-modal';
import { TransferDetailsModal } from '@/components/transfer-details-modal';

export default function TransferenciasPage() {
  const { authState } = useAuth();
  const { canRequestTransfer, canApproveTransfer, canManageTransfers } = usePermissions();
  const { toast } = useToast();

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  // Verificar si el usuario puede acceder a esta página
  const canAccess = canRequestTransfer || canApproveTransfer || canManageTransfers;

  useEffect(() => {
    // Verificar que tenemos el userDoc y accountId antes de cargar
    if (!authState.userDoc?.accountId || !canAccess || authState.loading) {
      return;
    }

    loadTransfers();
  }, [authState.userDoc?.accountId, canAccess, authState.loading]);

  const loadTransfers = async () => {
    try {
      setLoading(true);
      const accountId = authState.userDoc?.accountId;
      if (!accountId) return;

      // Los cajeros solo ven transferencias de su sucursal
      const branchId = canManageTransfers ? undefined : authState.userDoc?.branchId;
      const status = statusFilter === 'all' ? undefined : statusFilter;

      const transfersData = await TransferService.getTransfers(accountId, branchId, status);
      setTransfers(transfersData);
    } catch (error) {
      console.error('Error loading transfers:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las transferencias",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (transferId: string, newStatus: string) => {
    try {
      if (!authState.userDoc) return;

      await TransferService.updateTransferStatus(
        { transferId, status: newStatus },
        authState.userDoc
      );

      toast({
        title: "Transferencia actualizada",
        description: `La transferencia se ha marcado como ${getStatusLabel(newStatus)}`
      });

      // Recargar transferencias
      loadTransfers();
    } catch (error) {
      console.error('Error updating transfer status:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo actualizar la transferencia",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-blue-600"><CheckCircle className="w-3 h-3 mr-1" />Aprobada</Badge>;
      case 'in_transit':
        return <Badge variant="outline" className="text-purple-600"><ArrowRight className="w-3 h-3 mr-1" />En Tránsito</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Completada</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-red-600"><XCircle className="w-3 h-3 mr-1" />Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'pending': 'pendiente',
      'approved': 'aprobada',
      'in_transit': 'en tránsito',
      'completed': 'completada',
      'cancelled': 'cancelada'
    };
    return labels[status] || status;
  };

  const filteredTransfers = transfers.filter(transfer => {
    const matchesSearch = transfer.transferNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transfer.fromBranchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transfer.toBranchName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || transfer.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Mostrar carga mientras se autentica el usuario
  if (authState.loading || !authState.userDoc) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Acceso restringido</h3>
          <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transferencias</h1>
        <p className="text-muted-foreground">
          Gestiona las transferencias de productos entre sucursales
        </p>
      </div>

      {/* Controles */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar transferencias..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="approved">Aprobada</SelectItem>
              <SelectItem value="in_transit">En Tránsito</SelectItem>
              <SelectItem value="completed">Completada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canRequestTransfer && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Transferencia
          </Button>
        )}
      </div>

      {/* Lista de transferencias */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Cargando transferencias...</p>
        </div>
      ) : filteredTransfers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay transferencias</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? "No se encontraron transferencias con los filtros aplicados"
                : "Aún no se han creado transferencias entre sucursales"
              }
            </p>
            {canRequestTransfer && !searchTerm && statusFilter === 'all' && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Crear primera transferencia
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTransfers.map((transfer) => (
            <Card key={transfer.id} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedTransfer(transfer)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{transfer.transferNumber}</CardTitle>
                    <CardDescription>
                      <div className="flex items-center gap-2 mt-1">
                        <span>{transfer.fromBranchName}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        <span>{transfer.toBranchName}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Solicitado el {transfer.requestedAt.toLocaleDateString()}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(transfer.status)}
                    <span className="text-sm text-muted-foreground">
                      {transfer.totalItems} producto{transfer.totalItems !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Solicitado por: {transfer.requestedByName}</span>
                    {transfer.reason && (
                      <span>Motivo: {transfer.reason === 'out_of_stock' ? 'Sin stock' : transfer.reason}</span>
                    )}
                  </div>
                  
                  {canApproveTransfer && transfer.status === 'pending' && (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleStatusUpdate(transfer.id, 'approved')}
                      >
                        Aprobar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleStatusUpdate(transfer.id, 'cancelled')}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}

                  {canManageTransfers && transfer.status === 'approved' && (
                    <Button 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusUpdate(transfer.id, 'in_transit');
                      }}
                    >
                      Marcar como Enviado
                    </Button>
                  )}

                  {transfer.status === 'in_transit' && (
                    <Button 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusUpdate(transfer.id, 'completed');
                      }}
                    >
                      Confirmar Recepción
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modales */}
      <CreateTransferModal 
        isOpen={showCreateModal}
        onOpenChange={setShowCreateModal}
        onTransferCreated={loadTransfers}
      />

      <TransferDetailsModal 
        transfer={selectedTransfer}
        isOpen={!!selectedTransfer}
        onOpenChange={(open) => !open && setSelectedTransfer(null)}
        onStatusUpdate={handleStatusUpdate}
      />
    </div>
  );
}
