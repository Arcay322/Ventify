"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { TransferService } from '@/services/transfer-service';
import { CreateTransferModal } from '@/components/create-transfer-modal';
import { Plus, Search, Package, ArrowRightLeft, Clock, CheckCircle, XCircle, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Transfer } from '@/types/transfer';

const STATUS_COLORS = {
  pending: 'bg-yellow-500',
  approved: 'bg-blue-500', 
  in_transit: 'bg-purple-500',
  completed: 'bg-green-500',
  rejected: 'bg-red-500'
};

const STATUS_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  in_transit: 'En Tránsito', 
  completed: 'Completada',
  rejected: 'Rechazada'
};

const STATUS_ICONS = {
  pending: Clock,
  approved: CheckCircle,
  in_transit: Truck,
  completed: CheckCircle,
  rejected: XCircle
};

export default function TransfersPage() {
  const { toast } = useToast();
  const { userDoc, user } = useAuth();
  const { 
    canRequestTransfer, 
    canApproveTransfer, 
    canManageTransfers,
    canRequestTransferFromBranch,
    canApproveTransferToBranch,
    canCreateDirectTransfer,
    canViewTransfer,
    canUpdateTransferStatus,
    userBranchId,
    userRole
  } = usePermissions();
  
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [filteredTransfers, setFilteredTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    if (userDoc?.accountId) {
      loadTransfers();
    }
  }, [userDoc?.accountId]);

  useEffect(() => {
    filterTransfers();
  }, [transfers, searchTerm, statusFilter]);

  const loadTransfers = async () => {
    try {
      if (!userDoc?.accountId) return;
      
      setLoading(true);
      const allTransfers = await TransferService.getTransfers(userDoc.accountId);
      
      // Filtrar transferencias según permisos del usuario
      const visibleTransfers = allTransfers.filter(transfer => {
        // Owner y admin pueden ver todas las transferencias
        if (userRole === 'owner' || userRole === 'admin') {
          return true;
        }
        
        // Manager y cashier solo pueden ver transferencias donde su sucursal esté involucrada
        return canViewTransfer({
          sourceBranchId: transfer.sourceBranchId,
          destinationBranchId: transfer.destinationBranchId
        });
      });
      
      setTransfers(visibleTransfers);
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

  const filterTransfers = () => {
    let filtered = transfers;

    // Filtrar por término de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(transfer =>
        transfer.productName.toLowerCase().includes(term) ||
        transfer.fromBranchName.toLowerCase().includes(term) ||
        transfer.toBranchName.toLowerCase().includes(term) ||
        transfer.requestedByName.toLowerCase().includes(term)
      );
    }

    // Filtrar por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(transfer => transfer.status === statusFilter);
    }

    setFilteredTransfers(filtered);
  };

  const handleStatusUpdate = async (transferId: string, newStatus: Transfer['status']) => {
    try {
      if (!user?.uid) {
        console.error('No user uid available');
        return;
      }

      console.log('Updating transfer:', transferId, 'to status:', newStatus, 'by user:', user.uid);

      await TransferService.updateTransferStatus(
        transferId,
        newStatus,
        user.uid
      );

      toast({
        title: "Estado actualizado",
        description: newStatus === 'completed' 
          ? `La transferencia ha sido completada y el stock ha sido actualizado`
          : `La transferencia ha sido ${STATUS_LABELS[newStatus].toLowerCase()}`
      });

      // Recargar transferencias
      loadTransfers();
    } catch (error) {
      console.error('Error updating transfer status:', error);
      
      // Handle specific error types
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      let description = "No se pudo actualizar el estado de la transferencia";
      
      if (errorMessage.includes('Insufficient stock')) {
        description = "Stock insuficiente en la sucursal de origen para completar esta transferencia";
      } else if (errorMessage.includes('Product not found')) {
        description = "Uno o más productos de la transferencia no fueron encontrados";
      }
      
      toast({
        title: "Error",
        description,
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: Transfer['status']) => {
    const StatusIcon = STATUS_ICONS[status];
    return (
      <Badge className={`${STATUS_COLORS[status]} text-white`}>
        <StatusIcon className="w-3 h-3 mr-1" />
        {STATUS_LABELS[status]}
      </Badge>
    );
  };

  const getActionButtons = (transfer: Transfer) => {
    const buttons = [];

    // Botones para aprobar/rechazar (solo si el usuario puede aprobar a la sucursal destino)
    if (transfer.status === 'pending' && canApproveTransferToBranch(transfer.destinationBranchId)) {
      buttons.push(
        <Button
          key="approve"
          size="sm"
          onClick={() => handleStatusUpdate(transfer.id, 'approved')}
          className="mr-2"
        >
          Aprobar
        </Button>
      );
      buttons.push(
        <Button
          key="reject"
          size="sm"
          variant="destructive"
          onClick={() => handleStatusUpdate(transfer.id, 'rejected')}
        >
          Rechazar
        </Button>
      );
    }

    // Botón para marcar en tránsito (solo personal de sucursal origen)
    if (canUpdateTransferStatus(transfer, 'in_transit')) {
      buttons.push(
        <Button
          key="transit"
          size="sm"
          variant="outline"
          onClick={() => handleStatusUpdate(transfer.id, 'in_transit')}
        >
          En Tránsito
        </Button>
      );
    }

    // Botón para completar (solo personal de sucursal destino)
    if (canUpdateTransferStatus(transfer, 'completed')) {
      buttons.push(
        <Button
          key="complete"
          size="sm"
          onClick={() => handleStatusUpdate(transfer.id, 'completed')}
        >
          Completar
        </Button>
      );
    }

    return buttons;
  };

  const pendingCount = transfers.filter(t => t.status === 'pending').length;
  const inTransitCount = transfers.filter(t => t.status === 'in_transit').length;
  const completedCount = transfers.filter(t => t.status === 'completed').length;

  if (!canRequestTransfer()) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Acceso restringido</h3>
          <p className="text-muted-foreground">
            No tienes permisos para acceder al sistema de transferencias.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Transferencias</h1>
          <p className="text-muted-foreground">
            Gestiona las transferencias de productos entre sucursales
          </p>
        </div>
        
        {(canRequestTransfer() || canCreateDirectTransfer()) && (
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {canCreateDirectTransfer() ? 'Nueva Transferencia' : 'Solicitar Transferencia'}
          </Button>
        )}
      </div>

      {/* Información de permisos del usuario */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-sm text-blue-700">
          <Package className="h-4 w-4" />
          <span className="font-medium">Permisos actuales:</span>
          {userRole === 'owner' || userRole === 'admin' ? (
            <span>Puedes crear, aprobar y gestionar transferencias en todas las sucursales</span>
          ) : userRole === 'manager' ? (
            <span>Puedes solicitar transferencias desde tu sucursal y aprobar las que lleguen a ella</span>
          ) : userRole === 'cashier' ? (
            <span>Puedes solicitar transferencias desde tu sucursal</span>
          ) : (
            <span>Sin permisos de transferencias</span>
          )}
        </div>
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">En Tránsito</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{inTransitCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transfers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por producto, sucursal o usuario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="approved">Aprobadas</SelectItem>
                <SelectItem value="in_transit">En Tránsito</SelectItem>
                <SelectItem value="completed">Completadas</SelectItem>
                <SelectItem value="rejected">Rechazadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de transferencias */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Transferencias</CardTitle>
          <CardDescription>
            {filteredTransfers.length} de {transfers.length} transferencias
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="text-center py-8">
              <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No hay transferencias</h3>
              <p className="text-muted-foreground">
                {transfers.length === 0 
                  ? "No se han creado transferencias aún." 
                  : "No hay transferencias que coincidan con los filtros."
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>De → A</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Solicitado por</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{transfer.productName}</div>
                          <div className="text-sm text-muted-foreground">{transfer.productSku}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{transfer.fromBranchName}</span>
                          <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{transfer.toBranchName}</span>
                        </div>
                      </TableCell>
                      <TableCell>{transfer.quantity}</TableCell>
                      <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                      <TableCell>{transfer.requestedByName}</TableCell>
                      <TableCell>
                        {format(new Date(transfer.requestDate), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {getActionButtons(transfer)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTransferModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onTransferCreated={loadTransfers}
      />
    </div>
  );
}
