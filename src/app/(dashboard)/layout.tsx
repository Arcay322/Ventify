"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutGrid,
  ShoppingCart,
  Package,
  BarChart3,
  FileText,
  UserCircle,
  Landmark,
  Users,
  Settings,
  Store,
  Users2,
  ArrowRightLeft,
  Lock,
} from "lucide-react";
import React from "react";
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { logout } from '@/services/auth-service';

const navItems = [
  { 
    href: "/dashboard", 
    label: "Panel", 
    icon: LayoutGrid,
    permission: 'access_dashboard',
    roles: ['owner', 'admin', 'manager'] // Excluir cashier
  },
  { 
    href: "/sales", 
    label: "Ventas", 
    icon: ShoppingCart,
    permission: 'register_sale',
    roles: ['owner', 'admin', 'manager', 'cashier']
  },
  { 
    href: "/products", 
    label: "Productos", 
    icon: Package,
    permission: 'manage_products',
    roles: ['owner', 'admin', 'manager']
  },
  { 
    href: "/inventory", 
    label: "Inventario", 
    icon: BarChart3,
    permission: 'view_reports',
    roles: ['owner', 'admin', 'manager']
  },
  { 
    href: "/customers", 
    label: "Clientes", 
    icon: Users,
    permission: 'associate_customer',
    roles: ['owner', 'admin', 'manager', 'cashier']
  },
  { 
    href: "/transfers", 
    label: "Transferencias", 
    icon: ArrowRightLeft,
    permission: 'request_transfer',
    roles: ['owner', 'admin', 'manager', 'cashier']
  },
  { 
    href: "/cash-management", 
    label: "Caja", 
    icon: Landmark,
    permission: 'manage_cash_register',
    roles: ['owner', 'admin', 'manager']
  },
  { 
    href: "/branches", 
    label: "Sucursales", 
    icon: Store,
    permission: 'manage_branches',
    roles: ['owner', 'admin']
  },
  { 
    href: "/reports", 
    label: "Informes", 
    icon: FileText,
    permission: 'view_reports',
    roles: ['owner', 'admin', 'manager']
  },
];

const adminNavItems = [
  { 
    href: "/users", 
    label: "Usuarios", 
    icon: Users2,
    permission: 'manage_users',
    roles: ['owner', 'admin']
  },
  { 
    href: "/settings", 
    label: "Configuración", 
    icon: Settings,
    permission: 'manage_branches',
    roles: ['owner', 'admin']
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const NavigationMenu = () => {
    const { hasPermission, userRole } = usePermissions();

    // Filtrar elementos de navegación basado en permisos
    const filteredNavItems = navItems.filter(item => {
      if (item.permission && !hasPermission(item.permission as any)) {
        return false;
      }
      if (item.roles && !item.roles.includes(userRole as any)) {
        return false;
      }
      return true;
    });

    const filteredAdminItems = adminNavItems.filter(item => {
      if (item.permission && !hasPermission(item.permission as any)) {
        return false;
      }
      if (item.roles && !item.roles.includes(userRole as any)) {
        return false;
      }
      return true;
    });

    return (
      <SidebarMenu>
        {filteredNavItems.map((item) => (
          <SidebarMenuItem key={item.label}>
            <SidebarMenuButton
              asChild
              isActive={item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href)}
              tooltip={item.label}
            >
              <Link href={item.href}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        
        {filteredAdminItems.length > 0 && (
          <SidebarMenuItem>
            <div className="h-4" />
          </SidebarMenuItem>
        )}
        
        {filteredAdminItems.map((item) => (
          <SidebarMenuItem key={item.label}>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith(item.href)}
              tooltip={item.label}
            >
              <Link href={item.href}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        
        {/* Mensaje informativo para cashiers */}
        {userRole === 'cashier' && (
          <SidebarMenuItem>
            <div className="px-3 py-2 mt-4 bg-blue-50 rounded-md">
              <div className="flex items-center gap-2 text-xs text-blue-700">
                <Lock className="h-3 w-3" />
                <span>Acceso de cajero</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Algunas funciones requieren permisos adicionales
              </p>
            </div>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    );
  };

  const FooterAccount = () => {
    const { userDoc, user } = useAuth() as any;
    const { userRole } = usePermissions();
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="w-full justify-start h-auto text-left">
                <UserCircle className="w-8 h-8" />
                <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{userDoc?.displayName || user?.email || 'Usuario'}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{userRole || 'sin rol'}</span>
                      <div className={`w-2 h-2 rounded-full ${
                        userRole === 'owner' ? 'bg-purple-500' :
                        userRole === 'admin' ? 'bg-blue-500' :
                        userRole === 'manager' ? 'bg-green-500' :
                        'bg-gray-500'
                      }`} />
                    </div>
                </div>
            </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="mb-2 w-56">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Configuración</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={async () => { await logout(); window.location.href = '/auth/login'; }}>Salir</DropdownMenuItem>
        </DropdownMenuContent>
       </DropdownMenu>
    );
  };

  return (
    <AuthProvider>
    <SidebarProvider>
      <AuthGuard />
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-primary font-headline">
              Ventify
            </Link>
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <NavigationMenu />
        <SidebarFooter>
          <FooterAccount />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="p-4 sm:p-6 lg:p-8 bg-background min-h-screen">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
    </AuthProvider>
  );
}

function AuthGuard() {
  const { uid, initialized } = useAuth() as any;
  const router = require('next/navigation').useRouter();
  React.useEffect(() => {
    // if auth has initialized and there's no uid, redirect to login
    if (initialized && !uid) {
      router.push('/auth/login');
    }
  }, [initialized, uid]);
  return null;
}