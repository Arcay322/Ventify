"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
    const router = useRouter();
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
        // Primero ejecutar la función de llenar el carrito si existe
        if (onCompleteReservation) {
            onCompleteReservation(reservation);
        }
        
        // Luego redirigir al tab de punto de venta
        router.push('/sales?tab=pos');
        
        toast({
            title: "Redirigiendo a punto de venta",
            description: `Procesando reserva #${reservation.reservationNumber}`,
        });
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
                            {filteredReservations.map((reservation) => {
                                const daysUntilExpiry = reservation.expiryDate && reservation.status === 'pending' 
                                    ? Math.ceil((reservation.expiryDate - Date.now()) / (1000 * 60 * 60 * 24))
                                    : null;
                                const isUrgent = daysUntilExpiry !== null && daysUntilExpiry <= 1;
                                const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 2 && daysUntilExpiry > 1;
                                
                                return (
                                    <Card 
                                        key={reservation.id} 
                                        className={`border transition-all hover:shadow-lg hover:border-blue-300 cursor-pointer relative overflow-hidden ${
                                            isUrgent ? 'border-red-300 bg-gradient-to-r from-red-50 to-red-100/50' : 
                                            isExpiringSoon ? 'border-orange-300 bg-gradient-to-r from-orange-50 to-orange-100/50' : 
                                            'hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-blue-100/30'
                                        }`}
                                        onClick={() => {
                                            setSelectedReservation(reservation);
                                            setIsDetailModalOpen(true);
                                        }}
                                    >
                                        {/* Barra de estado lateral */}
                                        <div className={`absolute left-0 top-0 w-1 h-full ${
                                            reservation.status === 'pending' ? 'bg-blue-500' :
                                            reservation.status === 'completed' ? 'bg-green-500' :
                                            reservation.status === 'cancelled' ? 'bg-red-500' :
                                            'bg-gray-400'
                                        }`} />
                                        
                                        <CardContent className="p-5 pl-6">
                                            {/* Header con más información */}
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="font-bold text-lg text-gray-900">
                                                            #{reservation.reservationNumber}
                                                        </h3>
                                                        {getStatusBadge(reservation.status)}
                                                        {isUrgent && (
                                                            <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
                                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                                Urgente
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <User className="h-4 w-4 text-muted-foreground" />
                                                            <span className="font-semibold text-gray-700">{reservation.customerName}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="h-3 w-3" />
                                                                {format(new Date(reservation.date), "dd MMM", { locale: es })}
                                                            </span>
                                                            {reservation.customerPhone && (
                                                                <span className="flex items-center gap-1">
                                                                    <Phone className="h-3 w-3" />
                                                                    {reservation.customerPhone}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="text-right">
                                                    <p className="font-bold text-2xl text-gray-900">S/{reservation.total.toFixed(2)}</p>
                                                    <div className="text-sm space-y-1">
                                                        <p className="text-muted-foreground">
                                                            {reservation.items.reduce((acc, item) => acc + item.quantity, 0)} productos
                                                        </p>
                                                        {reservation.depositAmount && reservation.depositAmount > 0 && (
                                                            <p className="text-green-600 font-semibold">
                                                                Depósito: S/{reservation.depositAmount.toFixed(2)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Productos con mejor visualización */}
                                            <div className="mb-4 p-3 bg-gray-50/50 rounded-lg border">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-medium text-sm text-gray-700 flex items-center gap-1">
                                                        <FileText className="h-3 w-3" />
                                                        Productos reservados
                                                    </h4>
                                                    <span className="text-xs text-muted-foreground">
                                                        {reservation.items.length} {reservation.items.length === 1 ? 'artículo' : 'artículos'}
                                                    </span>
                                                </div>
                                                
                                                <div className="space-y-2 max-h-20 overflow-y-auto">
                                                    {reservation.items.slice(0, 2).map((item, index) => (
                                                        <div key={index} className="flex items-center gap-2 text-sm">
                                                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-semibold text-blue-700">
                                                                {item.quantity}
                                                            </div>
                                                            <span className="flex-1 truncate font-medium">{item.name}</span>
                                                            <span className="text-muted-foreground">S/{item.price.toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                    {reservation.items.length > 2 && (
                                                        <div className="text-xs text-muted-foreground text-center py-1">
                                                            +{reservation.items.length - 2} productos más...
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Información de tiempo y progreso */}
                                            {daysUntilExpiry !== null && reservation.status === 'pending' && (
                                                <div className="mb-4 p-3 bg-blue-50/50 rounded-lg border border-blue-200">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-medium text-blue-700 flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            Tiempo restante
                                                        </span>
                                                        <span className={`text-sm font-semibold ${
                                                            isUrgent ? 'text-red-600' : 
                                                            isExpiringSoon ? 'text-orange-600' : 
                                                            'text-blue-600'
                                                        }`}>
                                                            {daysUntilExpiry === 0 ? 'Vence hoy' :
                                                             daysUntilExpiry === 1 ? 'Vence mañana' :
                                                             `${daysUntilExpiry} días`}
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-blue-200 rounded-full h-2.5">
                                                        <div 
                                                            className={`h-2.5 rounded-full transition-all ${
                                                                isUrgent ? 'bg-red-500' :
                                                                isExpiringSoon ? 'bg-orange-500' :
                                                                'bg-blue-500'
                                                            }`}
                                                            style={{ 
                                                                width: `${Math.max(15, Math.min(100, (7 - daysUntilExpiry) / 7 * 100))}%` 
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Notas si las hay */}
                                            {reservation.notes && (
                                                <div className="mb-4 p-2 bg-yellow-50/50 rounded border border-yellow-200">
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                                        <FileText className="h-3 w-3" />
                                                        Nota:
                                                    </p>
                                                    <p className="text-sm line-clamp-2">{reservation.notes}</p>
                                                </div>
                                            )}

                                            {/* Footer con acciones mejoradas */}
                                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 px-3 text-xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedReservation(reservation);
                                                            setIsDetailModalOpen(true);
                                                        }}
                                                    >
                                                        <Eye className="h-3 w-3 mr-1" />
                                                        Detalles
                                                    </Button>
                                                    
                                                    {reservation.customerPhone && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                window.open(`tel:${reservation.customerPhone}`, '_self');
                                                            }}
                                                        >
                                                            <Phone className="h-3 w-3 mr-1" />
                                                            Llamar
                                                        </Button>
                                                    )}
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    {reservation.status === 'pending' ? (
                                                        <>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedReservation(reservation);
                                                                    setIsCancelModalOpen(true);
                                                                }}
                                                            >
                                                                <XCircle className="h-3 w-3 mr-1" />
                                                                Cancelar
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCompleteReservation(reservation);
                                                                }}
                                                                className="bg-green-600 hover:bg-green-700 h-8 px-4 font-semibold"
                                                            >
                                                                <CreditCard className="h-3 w-3 mr-2" />
                                                                Procesar Venta
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            {reservation.status === 'completed' && (
                                                                <>
                                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                                    <span>Completada</span>
                                                                </>
                                                            )}
                                                            {reservation.status === 'cancelled' && (
                                                                <>
                                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                                    <span>Cancelada</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal de detalles avanzado */}
            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {selectedReservation && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-5 w-5" />
                                        Reserva #{selectedReservation.reservationNumber}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(selectedReservation.status)}
                                        {selectedReservation.customerPhone && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => window.open(`tel:${selectedReservation.customerPhone}`, '_self')}
                                            >
                                                <Phone className="h-4 w-4 mr-2" />
                                                Llamar
                                            </Button>
                                        )}
                                        {selectedReservation.customerEmail && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => window.open(`mailto:${selectedReservation.customerEmail}`, '_self')}
                                            >
                                                <Mail className="h-4 w-4 mr-2" />
                                                Email
                                            </Button>
                                        )}
                                    </div>
                                </DialogTitle>
                                <DialogDescription className="text-base">
                                    Gestiona todos los aspectos de esta reserva desde aquí
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Columna izquierda: Información principal */}
                                <div className="space-y-6">
                                    {/* Timeline de la reserva */}
                                    <div>
                                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            Línea de tiempo
                                        </h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm">Reserva creada</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {format(new Date(selectedReservation.date), "PPP p", { locale: es })}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {selectedReservation.depositAmount && selectedReservation.depositAmount > 0 && (
                                                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                                                    <div className="flex-1">
                                                        <div className="font-medium text-sm">Depósito recibido</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            S/{selectedReservation.depositAmount.toFixed(2)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedReservation.expiryDate && selectedReservation.status === 'pending' && (
                                                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                                                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                                                    <div className="flex-1">
                                                        <div className="font-medium text-sm">Fecha límite</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {format(new Date(selectedReservation.expiryDate), "PPP", { locale: es })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedReservation.completedDate && (
                                                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                                                    <div className="flex-1">
                                                        <div className="font-medium text-sm">Venta completada</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {format(new Date(selectedReservation.completedDate), "PPP p", { locale: es })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedReservation.status === 'cancelled' && (
                                                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                                                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                                                    <div className="flex-1">
                                                        <div className="font-medium text-sm">Reserva cancelada</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {selectedReservation.cancellationReason || 'Sin razón especificada'}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Información del cliente */}
                                    <div>
                                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            Información del cliente
                                        </h3>
                                        <div className="p-4 border rounded-lg space-y-2">
                                            <div className="font-medium text-lg">{selectedReservation.customerName}</div>
                                            {selectedReservation.customerPhone && (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Phone className="h-3 w-3" />
                                                    <span>{selectedReservation.customerPhone}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2 ml-auto"
                                                        onClick={() => window.open(`tel:${selectedReservation.customerPhone}`, '_self')}
                                                    >
                                                        <Phone className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                            {selectedReservation.customerEmail && (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Mail className="h-3 w-3" />
                                                    <span>{selectedReservation.customerEmail}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2 ml-auto"
                                                        onClick={() => window.open(`mailto:${selectedReservation.customerEmail}`, '_self')}
                                                    >
                                                        <Mail className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Resumen financiero */}
                                    <div>
                                        <h3 className="font-semibold mb-3">Resumen financiero</h3>
                                        <div className="p-4 border rounded-lg space-y-3">
                                            <div className="flex justify-between text-sm">
                                                <span>Subtotal:</span>
                                                <span>S/{selectedReservation.subtotal.toFixed(2)}</span>
                                            </div>
                                            {selectedReservation.discount > 0 && (
                                                <div className="flex justify-between text-sm text-red-600">
                                                    <span>Descuento:</span>
                                                    <span>-S/{selectedReservation.discount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            <Separator />
                                            <div className="flex justify-between font-semibold">
                                                <span>Total:</span>
                                                <span>S/{selectedReservation.total.toFixed(2)}</span>
                                            </div>
                                            {selectedReservation.depositAmount && selectedReservation.depositAmount > 0 && (
                                                <>
                                                    <div className="flex justify-between text-sm text-green-600">
                                                        <span>Depósito pagado:</span>
                                                        <span>S/{selectedReservation.depositAmount.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between font-medium text-orange-600">
                                                        <span>Pendiente:</span>
                                                        <span>S/{(selectedReservation.total - selectedReservation.depositAmount).toFixed(2)}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Columna derecha: Productos y notas */}
                                <div className="space-y-6">
                                    {/* Productos detallados */}
                                    <div>
                                        <h3 className="font-semibold mb-3">Productos reservados</h3>
                                        <div className="space-y-3 max-h-96 overflow-y-auto">
                                            {selectedReservation.items.map((item, index) => (
                                                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50">
                                                    {item.imageUrl ? (
                                                        <Image 
                                                            src={item.imageUrl} 
                                                            alt={item.name} 
                                                            width={50} 
                                                            height={50} 
                                                            className="rounded object-cover" 
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                                            <FileText className="h-5 w-5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium truncate">{item.name}</div>
                                                        <div className="text-sm text-muted-foreground">SKU: {item.sku}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {item.quantity}x S/{item.price.toFixed(2)} c/u
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-semibold">
                                                            S/{(item.quantity * item.price).toFixed(2)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Notas y comentarios */}
                                    {selectedReservation.notes && (
                                        <div>
                                            <h3 className="font-semibold mb-3">Notas de la reserva</h3>
                                            <div className="p-4 bg-muted/50 rounded-lg">
                                                <p className="text-sm whitespace-pre-wrap">
                                                    {selectedReservation.notes}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
                                <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                                    Cerrar
                                </Button>
                                {selectedReservation.status === 'pending' && (
                                    <>
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
                                        <Button
                                            onClick={() => {
                                                setIsDetailModalOpen(false);
                                                handleCompleteReservation(selectedReservation);
                                            }}
                                            className="bg-green-600 hover:bg-green-700"
                                        >
                                            <CreditCard className="h-4 w-4 mr-2" />
                                            Procesar Venta Completa
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
