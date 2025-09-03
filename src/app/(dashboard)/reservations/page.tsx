"use client"

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { ReservationsManager } from '@/components/reservations-manager';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Reservation } from '@/types/reservation';
import { useRouter } from 'next/navigation';

export default function ReservationsPage() {
    const authState = useAuth();
    const { isCashier, isManager, isOwner, isAdmin } = usePermissions();
    const router = useRouter();

    const handleCompleteReservation = (reservation: Reservation) => {
        // Redirect to sales page with reservation data
        router.push('/sales?tab=pos&completeReservation=' + reservation.id);
    };

    if (!authState.initialized) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="text-center">
                    <div className="animate-pulse text-muted-foreground">Cargando...</div>
                </div>
            </div>
        );
    }

    if (!authState.user) {
        return (
            <Alert variant="destructive" className="max-w-xl mx-auto mt-10">
                <AlertTitle>Acceso Denegado</AlertTitle>
                <AlertDescription>
                    Debes iniciar sesión para acceder a esta página.
                </AlertDescription>
            </Alert>
        );
    }

    if (!isCashier() && !isManager() && !isOwner() && !isAdmin()) {
        return (
            <Alert variant="destructive" className="max-w-xl mx-auto mt-10">
                <AlertTitle>Sin Permisos</AlertTitle>
                <AlertDescription>
                    No tienes permisos para gestionar reservas.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" asChild>
                    <Link href="/sales">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Volver a Ventas
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Calendar className="h-8 w-8" />
                        Gestión de Reservas
                    </h1>
                    <p className="text-muted-foreground">
                        Administra las reservas de pedidos de tus clientes
                    </p>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Stats Cards - opcional para mostrar estadísticas */}
                <div className="grid md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-blue-600" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Pendientes</p>
                                    <p className="text-2xl font-bold">-</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-green-600" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Completadas</p>
                                    <p className="text-2xl font-bold">-</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-orange-600" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Vencidas</p>
                                    <p className="text-2xl font-bold">-</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-red-600" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Canceladas</p>
                                    <p className="text-2xl font-bold">-</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Reservations Manager */}
                <ReservationsManager 
                    branchId={authState.userDoc?.branchId}
                    onCompleteReservation={handleCompleteReservation}
                />
            </div>
        </div>
    );
}
