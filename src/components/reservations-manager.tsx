"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ReservationService } from '@/services/reservation-service';
import { Reservation, ReservationStatus } from '@/types/reservation';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    Calendar, 
    Clock, 
    User, 
    Phone, 
    Mail, 
    FileText, 
    CheckCircle, 
    XCircle, 
    AlertTriangle,
    Search,
    Eye,
    CreditCard,
    X
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

interface ReservationsManagerProps {
    branchId?: string;
    onCompleteReservation?: (reservation: Reservation) => void;
}

export function ReservationsManager({ branchId, onCompleteReservation }: ReservationsManagerProps) {
    const authState = useAuth();
    const { toast } = useToast();
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authState.initialized || !authState.userDoc?.accountId) return;

        const unsubscribe = ReservationService.getReservations(
            (reservationList) => {
                setReservations(reservationList);
                setLoading(false);
            },
            authState.userDoc.accountId,
            branchId
        );

        return unsubscribe;
    }, [authState.initialized, authState.userDoc?.accountId, branchId]);

    // Filtrar reservas
    useEffect(() => {
        let filtered = reservations;

        // Filtrar por estado
        if (statusFilter !== 'all') {
            filtered = filtered.filter(r => r.status === statusFilter);
        }

        // Filtrar por búsqueda
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(r => 
                r.customerName.toLowerCase().includes(query) ||
                r.customerPhone?.toLowerCase().includes(query) ||
                r.customerEmail?.toLowerCase().includes(query) ||
                r.id.toLowerCase().includes(query) ||
                r.reservationNumber?.toString().includes(query)
            );
        }

        setFilteredReservations(filtered);
    }, [reservations, searchQuery, statusFilter]);

    const getStatusBadge = (status: ReservationStatus) => {
        const config = {
            pending: { label: 'Pendiente', variant: 'default' as const, icon: Clock },
            completed: { label: 'Completada', variant: 'default' as const, icon: CheckCircle, className: 'bg-green-100 text-green-800' },
            cancelled: { label: 'Cancelada', variant: 'destructive' as const, icon: XCircle },
            expired: { label: 'Vencida', variant: 'secondary' as const, icon: AlertTriangle, className: 'bg-orange-100 text-orange-800' }
        };

        const { label, variant, icon: Icon, className } = config[status];
        return (
            <Badge variant={variant} className={className}>
                <Icon className="h-3 w-3 mr-1" />
                {label}
            </Badge>
        );
    };

    const handleCompleteReservation = (reservation: Reservation) => {
        if (onCompleteReservation) {
            onCompleteReservation(reservation);
        } else {
            toast({
                title: "Función no disponible",
                description: "Esta función debe ser implementada desde el módulo de ventas",
                variant: "destructive"
            });
        }
    };

    const handleCancelReservation = async () => {
        if (!selectedReservation) return;

        try {
            await ReservationService.cancelReservation(
                selectedReservation.id, 
                cancellationReason.trim() || undefined
            );

            toast({
                title: "Reserva cancelada",
                description: `La reserva #${selectedReservation.reservationNumber} ha sido cancelada`
            });

            setIsCancelModalOpen(false);
            setCancellationReason('');
            setSelectedReservation(null);
        } catch (error) {
            console.error('Error cancelling reservation:', error);
            toast({
                title: "Error al cancelar",
                description: error instanceof Error ? error.message : "No se pudo cancelar la reserva",
                variant: "destructive"
            });
        }
    };

    const isExpiringSoon = (reservation: Reservation) => {
        if (reservation.status !== 'pending' || !reservation.expiryDate) return false;
        const daysUntilExpiry = (reservation.expiryDate - Date.now()) / (1000 * 60 * 60 * 24);
        return daysUntilExpiry <= 2;
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-10">
                    <div className="text-center">
                        <div className="animate-pulse text-muted-foreground">Cargando reservas...</div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Gestión de Reservas</CardTitle>
                    <CardDescription>
                        Administra las reservas de pedidos de tus clientes
                    </CardDescription>
                    
                    <div className="flex flex-col sm:flex-row gap-4 mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por cliente, teléfono, email o número..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                variant={statusFilter === 'all' ? 'default' : 'outline'} 
                                size="sm"
                                onClick={() => setStatusFilter('all')}
                            >
                                Todas
                            </Button>
                            <Button 
                                variant={statusFilter === 'pending' ? 'default' : 'outline'} 
                                size="sm"
                                onClick={() => setStatusFilter('pending')}
                            >
                                Pendientes
                            </Button>
                            <Button 
                                variant={statusFilter === 'completed' ? 'default' : 'outline'} 
                                size="sm"
                                onClick={() => setStatusFilter('completed')}
                            >
                                Completadas
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {filteredReservations.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {searchQuery ? 
                                `No se encontraron reservas que coincidan con "${searchQuery}"` :
                                statusFilter === 'all' ? 
                                    'No hay reservas registradas' :
                                    `No hay reservas ${statusFilter === 'pending' ? 'pendientes' : statusFilter === 'completed' ? 'completadas' : 'canceladas'}`
                            }
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredReservations.map((reservation) => (
                                <Card key={reservation.id} className={`border ${
                                    isExpiringSoon(reservation) ? 'border-orange-300 bg-orange-50/50' : ''
                                }`}>
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold">
                                                        Reserva #{reservation.reservationNumber}
                                                    </h3>
                                                    {getStatusBadge(reservation.status)}
                                                    {isExpiringSoon(reservation) && (
                                                        <Badge variant="outline" className="text-orange-600">
                                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                                            Vence pronto
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    Creada: {format(new Date(reservation.date), "PPP p", { locale: es })}
                                                </p>
                                                {reservation.expiryDate && reservation.status === 'pending' && (
                                                    <p className="text-sm text-muted-foreground">
                                                        Vence: {format(new Date(reservation.expiryDate), "PPP", { locale: es })}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-lg">S/{reservation.total.toFixed(2)}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {reservation.items.reduce((acc, item) => acc + item.quantity, 0)} productos
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-3 gap-4 mb-4">
                                            <div>
                                                <h4 className="font-medium text-sm mb-1 flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    Cliente
                                                </h4>
                                                <p className="text-sm">{reservation.customerName}</p>
                                                {reservation.customerPhone && (
                                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                        <Phone className="h-3 w-3" />
                                                        {reservation.customerPhone}
                                                    </p>
                                                )}
                                                {reservation.customerEmail && (
                                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                        <Mail className="h-3 w-3" />
                                                        {reservation.customerEmail}
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <h4 className="font-medium text-sm mb-1">Productos</h4>
                                                <div className="space-y-1 max-h-20 overflow-y-auto">
                                                    {reservation.items.slice(0, 3).map((item, index) => (
                                                        <p key={index} className="text-sm text-muted-foreground">
                                                            {item.quantity}x {item.name}
                                                        </p>
                                                    ))}
                                                    {reservation.items.length > 3 && (
                                                        <p className="text-sm text-muted-foreground">
                                                            +{reservation.items.length - 3} más...
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                {reservation.depositAmount && reservation.depositAmount > 0 && (
                                                    <div className="mb-2">
                                                        <h4 className="font-medium text-sm mb-1">Depósito</h4>
                                                        <p className="text-sm font-semibold text-green-600">
                                                            S/{reservation.depositAmount.toFixed(2)}
                                                        </p>
                                                    </div>
                                                )}
                                                {reservation.notes && (
                                                    <div>
                                                        <h4 className="font-medium text-sm mb-1">Notas</h4>
                                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                                            {reservation.notes}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-2 border-t">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedReservation(reservation);
                                                    setIsDetailModalOpen(true);
                                                }}
                                            >
                                                <Eye className="h-4 w-4 mr-2" />
                                                Ver Detalles
                                            </Button>
                                            
                                            {reservation.status === 'pending' && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleCompleteReservation(reservation)}
                                                        className="bg-green-600 hover:bg-green-700"
                                                    >
                                                        <CreditCard className="h-4 w-4 mr-2" />
                                                        Procesar Venta
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedReservation(reservation);
                                                            setIsCancelModalOpen(true);
                                                        }}
                                                    >
                                                        <XCircle className="h-4 w-4 mr-2" />
                                                        Cancelar
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal de detalles */}
            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    {selectedReservation && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5" />
                                    Detalles de Reserva #{selectedReservation.reservationNumber}
                                </DialogTitle>
                                <DialogDescription>
                                    {getStatusBadge(selectedReservation.status)}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                {/* Información general */}
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <h3 className="font-semibold mb-2">Información General</h3>
                                        <div className="space-y-2 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">Creada:</span>{' '}
                                                {format(new Date(selectedReservation.date), "PPP p", { locale: es })}
                                            </div>
                                            {selectedReservation.expiryDate && (
                                                <div>
                                                    <span className="text-muted-foreground">Vence:</span>{' '}
                                                    {format(new Date(selectedReservation.expiryDate), "PPP", { locale: es })}
                                                </div>
                                            )}
                                            {selectedReservation.completedDate && (
                                                <div>
                                                    <span className="text-muted-foreground">Completada:</span>{' '}
                                                    {format(new Date(selectedReservation.completedDate), "PPP p", { locale: es })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold mb-2">Cliente</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="font-medium">{selectedReservation.customerName}</div>
                                            {selectedReservation.customerPhone && (
                                                <div className="flex items-center gap-1">
                                                    <Phone className="h-3 w-3" />
                                                    {selectedReservation.customerPhone}
                                                </div>
                                            )}
                                            {selectedReservation.customerEmail && (
                                                <div className="flex items-center gap-1">
                                                    <Mail className="h-3 w-3" />
                                                    {selectedReservation.customerEmail}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Productos */}
                                <div>
                                    <h3 className="font-semibold mb-3">Productos Reservados</h3>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {selectedReservation.items.map((item, index) => (
                                            <div key={index} className="flex items-center gap-3 p-2 border rounded">
                                                {item.imageUrl ? (
                                                    <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="rounded" />
                                                ) : (
                                                    <div className="w-10 h-10 bg-muted rounded" />
                                                )}
                                                <div className="flex-1">
                                                    <div className="font-medium">{item.name}</div>
                                                    <div className="text-sm text-muted-foreground">SKU: {item.sku}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-semibold">
                                                        {item.quantity}x S/{item.price.toFixed(2)}
                                                    </div>
                                                    <div className="text-sm font-bold">
                                                        S/{(item.quantity * item.price).toFixed(2)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Totales */}
                                <div className="border-t pt-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span>Subtotal:</span>
                                            <span>S/{selectedReservation.subtotal.toFixed(2)}</span>
                                        </div>
                                        {selectedReservation.discount > 0 && (
                                            <div className="flex justify-between text-red-600">
                                                <span>Descuento:</span>
                                                <span>-S/{selectedReservation.discount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        {selectedReservation.depositAmount && selectedReservation.depositAmount > 0 && (
                                            <div className="flex justify-between text-green-600">
                                                <span>Depósito pagado:</span>
                                                <span>S/{selectedReservation.depositAmount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between font-bold text-lg border-t pt-2">
                                            <span>Total:</span>
                                            <span>S/{selectedReservation.total.toFixed(2)}</span>
                                        </div>
                                        {selectedReservation.depositAmount && selectedReservation.depositAmount > 0 && (
                                            <div className="flex justify-between font-medium text-orange-600">
                                                <span>Pendiente por pagar:</span>
                                                <span>S/{(selectedReservation.total - selectedReservation.depositAmount).toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Notas */}
                                {selectedReservation.notes && (
                                    <div>
                                        <h3 className="font-semibold mb-2">Notas</h3>
                                        <p className="text-sm p-3 bg-muted/50 rounded">
                                            {selectedReservation.notes}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                                    Cerrar
                                </Button>
                                {selectedReservation.status === 'pending' && (
                                    <>
                                        <Button
                                            onClick={() => {
                                                setIsDetailModalOpen(false);
                                                handleCompleteReservation(selectedReservation);
                                            }}
                                            className="bg-green-600 hover:bg-green-700"
                                        >
                                            <CreditCard className="h-4 w-4 mr-2" />
                                            Procesar Venta
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            onClick={() => {
                                                setIsDetailModalOpen(false);
                                                setIsCancelModalOpen(true);
                                            }}
                                        >
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Cancelar Reserva
                                        </Button>
                                    </>
                                )}
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal de cancelación */}
            <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancelar Reserva</DialogTitle>
                        <DialogDescription>
                            ¿Estás seguro de que quieres cancelar esta reserva? Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="cancellationReason">Razón de cancelación (opcional)</Label>
                            <Textarea
                                id="cancellationReason"
                                value={cancellationReason}
                                onChange={(e) => setCancellationReason(e.target.value)}
                                placeholder="Motivo de la cancelación..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>
                            No, mantener reserva
                        </Button>
                        <Button variant="destructive" onClick={handleCancelReservation}>
                            Sí, cancelar reserva
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
