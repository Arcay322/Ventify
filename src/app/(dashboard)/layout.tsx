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
} from "lucide-react";
import React from "react";
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { logout } from '@/services/auth-service';

const navItems = [
  { href: "/dashboard", label: "Panel", icon: LayoutGrid },
  { href: "/sales", label: "Ventas", icon: ShoppingCart },
  { href: "/products", label: "Productos", icon: Package },
  { href: "/inventory", label: "Inventario", icon: BarChart3 },
  { href: "/customers", label: "Clientes", icon: Users },
  { href: "/cash-management", label: "Caja", icon: Landmark },
  { href: "/branches", label: "Sucursales", icon: Store },
  { href: "/reports", label: "Informes", icon: FileText },
];

const adminNavItems = [
    { href: "/users", label: "Usuarios", icon: Users2 },
    { href: "/settings", label: "Configuración", icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const FooterAccount = () => {
    const { userDoc, user } = useAuth() as any;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="w-full justify-start h-auto text-left">
                <UserCircle className="w-8 h-8" />
                <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{userDoc?.displayName || user?.email || 'Usuario'}</span>
                    <span className="text-xs text-muted-foreground">{userDoc?.role || 'sin rol'}</span>
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
  }

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
        <SidebarMenu>
          {navItems.map((item) => (
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
          <SidebarMenuItem>
            <div className="h-4" />
          </SidebarMenuItem>
           {adminNavItems.map((item) => (
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
        </SidebarMenu>
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