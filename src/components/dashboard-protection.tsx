"use client"

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/hooks/use-auth';
import { AlertTriangle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface DashboardProtectionProps {
  children: ReactNode;
  redirectTo?: string;
  showMessage?: boolean;
}

export default function DashboardProtection({ 
  children, 
  redirectTo = '/sales',
  showMessage = true 
}: DashboardProtectionProps) {
  const { canAccessDashboard, userRole, isCashier } = usePermissions();
  const { userDoc, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Si está cargando, esperar
    if (loading) return;

    // Si no hay usuario autenticado, redirigir al login
    if (!userDoc) {
      router.push('/auth/login');
      return;
    }

    // Si es cashier, redirigir automáticamente sin mostrar mensaje
    if (isCashier() && !showMessage) {
      router.push(redirectTo);
      return;
    }
  }, [userDoc, loading, isCashier, router, redirectTo, showMessage]);

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Si no hay usuario, no mostrar nada (se redirigirá)
  if (!userDoc) {
    return null;
  }

  // Si no tiene acceso al dashboard, mostrar mensaje de error
  if (!canAccessDashboard()) {
    if (!showMessage && isCashier()) {
      return null; // Se redirigirá automáticamente
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6 p-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-orange-500" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Acceso Denegado</h2>
            <p className="text-gray-600 max-w-md">
              {isCashier() 
                ? "Los cajeros no tienen acceso al dashboard. Tu función está enfocada en el registro de ventas."
                : "No tienes permisos para acceder al dashboard. Contacta a tu administrador si crees que esto es un error."
              }
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
            <Lock className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Rol actual: <span className="font-medium">{userRole || 'No definido'}</span>
            </span>
          </div>

          <div className="flex gap-3">
            <Button asChild>
              <Link href="/sales">Ir a Ventas</Link>
            </Button>
            {!isCashier() && (
              <Button variant="outline" asChild>
                <Link href="/support">Contactar Soporte</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Información adicional para diferentes roles */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg max-w-md text-center">
          <h3 className="font-medium text-blue-900 mb-2">¿Necesitas acceso al dashboard?</h3>
          <p className="text-sm text-blue-700">
            {isCashier() 
              ? "El dashboard está diseñado para supervisores. Tu rol de cajero te da acceso completo al sistema de ventas."
              : "Los permisos del dashboard requieren rol de Manager o superior. Contacta a tu administrador para revisar tu nivel de acceso."
            }
          </p>
        </div>
      </div>
    );
  }

  // Si tiene acceso, mostrar el contenido
  return <>{children}</>;
}

// Hook para validación programática
export function useDashboardAccess() {
  const { canAccessDashboard, isCashier, userRole } = usePermissions();
  const { userDoc } = useAuth();

  return {
    hasAccess: canAccessDashboard(),
    isCashier: isCashier(),
    userRole,
    isAuthenticated: !!userDoc,
    canBypass: false // No permitir bypass de seguridad
  };
}
