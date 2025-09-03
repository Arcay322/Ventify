"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { DollarSign, Package, Users, ShoppingCart, Filter, Lock, AlertTriangle } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBranches } from '@/services/branch-service';
import { getSales } from '@/services/sales-service';
import { ReservationDepositService } from '@/services/reservation-deposit-service';
import { getActiveSession } from '@/services/cash-register-service';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { subDays, startOfDay, endOfDay, formatISO } from 'date-fns';

export default function DashboardPage() {
  // Validaciones de acceso basadas en roles
  const { canAccessDashboard, isOwner, isAdmin, isManager, userRole, userBranchId } = usePermissions();
  const authState = useAuth();

  // Verificar si el usuario tiene acceso al dashboard
  if (!canAccessDashboard()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertTriangle className="h-16 w-16 text-orange-500" />
        <h2 className="text-2xl font-bold text-gray-900">Acceso Denegado</h2>
        <p className="text-gray-600 text-center max-w-md">
          No tienes permisos para acceder al dashboard. Contacta a tu administrador si crees que esto es un error.
        </p>
        <p className="text-sm text-gray-500">
          Rol actual: <span className="font-medium">{userRole || 'No definido'}</span>
        </p>
        <Button asChild>
          <Link href="/sales">Ir a Ventas</Link>
        </Button>
      </div>
    );
  }

  const [selectedBranch, setSelectedBranch] = useState('all');
  const [branches, setBranches] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [reservationDeposits, setReservationDeposits] = useState<any[]>([]);
  const [cashSession, setCashSession] = useState<any>(null);
  const [kpis, setKpis] = useState({ 
    totalSales: 0, 
    avgTicket: 0, 
    transactions: 0,
    totalDeposits: 0,
    pendingDeposits: 0
  });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [paymentDist, setPaymentDist] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const accountId = authState.userDoc?.accountId as string | undefined;
    if (!accountId) return;

    // Para managers, establecer automáticamente su sucursal
    if (isManager() && userBranchId && selectedBranch === 'all') {
      setSelectedBranch(userBranchId);
    }

    // Cargar sucursales
    const unsubBranches = getBranches(setBranches, accountId);
    
    // Cargar ventas  
    const unsubSales = getSales((s) => setSales(s), accountId);

    // Cargar depósitos de reservas activos
    const loadReservationDeposits = async () => {
      if (selectedBranch && selectedBranch !== 'all') {
        const deposits = await ReservationDepositService.getActiveDeposits(selectedBranch, accountId);
        setReservationDeposits(deposits);
      } else {
        // Para "all", necesitaríamos cargar de todas las sucursales
        setReservationDeposits([]);
      }
    };

    // Cargar sesión de caja activa
    const loadCashSession = async () => {
      if (selectedBranch && selectedBranch !== 'all') {
        try {
          const session = await getActiveSession(selectedBranch, accountId);
          setCashSession(session);
        } catch (error) {
          setCashSession(null);
        }
      } else {
        setCashSession(null);
      }
    };

    loadReservationDeposits();
    loadCashSession();

    return () => { 
      try { unsubBranches(); } catch(e){}; 
      try { unsubSales(); } catch(e){}; 
    };
  }, [authState.userDoc?.accountId, selectedBranch]);

  useEffect(() => {
    // Recompute KPIs when sales, deposits, or selectedBranch change
    const now = Date.now();
    const todayStart = startOfDay(new Date()).getTime();
    const filtered = sales.filter(s => selectedBranch === 'all' ? true : s.branchId === selectedBranch);
    const todaySales = filtered.filter(s => (s.date || 0) >= todayStart);
    
    // KPIs de ventas
    const totalSales = todaySales.reduce((a, b) => a + (b.total || 0), 0);
    const transactions = todaySales.length;
    const avgTicket = transactions > 0 ? totalSales / transactions : 0;
    
    // KPIs de depósitos
    const totalDeposits = reservationDeposits.reduce((a, b) => a + (b.amount || 0), 0);
    const pendingDeposits = reservationDeposits.length;
    
    setKpis({ 
      totalSales, 
      avgTicket, 
      transactions,
      totalDeposits,
      pendingDeposits
    });

    // Weekly data - last 7 days
    const days = Array.from({ length: 7 }).map((_, i) => {
      const day = subDays(new Date(), 6 - i);
      const start = startOfDay(day).getTime();
      const end = endOfDay(day).getTime();
      const daySales = filtered.filter(s => (s.date || 0) >= start && (s.date || 0) <= end);
      const dayName = day.toLocaleDateString('es-ES', { weekday: 'short' });
      return { 
        day: dayName, 
        sales: daySales.reduce((a,b) => a + (b.total || 0), 0) 
      };
    });
    setWeeklyData(days);

    // Payment distribution - today only
    const methods: Record<string, number> = {};
    todaySales.forEach(s => { 
      const method = s.paymentMethod || 'Desconocido';
      methods[method] = (methods[method] || 0) + (s.total || 0); 
    });
    
    const colors = [
      'hsl(var(--chart-1))',
      'hsl(var(--chart-2))', 
      'hsl(var(--chart-3))',
      'hsl(var(--chart-4))',
      'hsl(var(--chart-5))'
    ];
    
    setPaymentDist(Object.entries(methods).map(([name, value], index) => ({ 
      name, 
      value, 
      color: colors[index % colors.length] 
    })));

    // Top products - today only (aggregate units sold from sales.items)
    const prodCounts: Record<string, { sku: string; name: string; units: number }> = {};
    todaySales.forEach(s => {
      (s.items || []).forEach((it: any) => {
        const key = it.sku || it.id;
        if (!prodCounts[key]) prodCounts[key] = { sku: it.sku || it.id, name: it.name, units: 0 };
        prodCounts[key].units += it.quantity || 0;
      });
    });
    const top = Object.values(prodCounts).sort((a,b) => b.units - a.units).slice(0,5);
    setTopProducts(top);
  }, [sales, selectedBranch, reservationDeposits]);

  const generateZReport = async (branchId = selectedBranch, from = startOfDay(new Date()).getTime(), to = endOfDay(new Date()).getTime()) => {
    try {
      const filtered = sales.filter(s => (branchId === 'all' ? true : s.branchId === branchId) && (s.date || 0) >= from && (s.date || 0) <= to);
      const totalsByMethod: Record<string, number> = {};
      filtered.forEach(s => { totalsByMethod[s.paymentMethod || 'Unknown'] = (totalsByMethod[s.paymentMethod || 'Unknown'] || 0) + (s.total || 0); });
      const doc = await addDoc(collection(db, 'cash_closures'), {
        branchId,
        from,
        to,
        createdAt: Date.now(),
        totalsByMethod,
        transactions: filtered.length,
        total: filtered.reduce((a,b) => a + (b.total || 0), 0),
      });
      toast({ title: 'Reporte Z generado', description: `ID: ${doc.id}` });
    } catch (err) {
      console.error('Z report error', err);
      toast({ title: 'Error', description: 'No se pudo generar el reporte Z', variant: 'destructive' });
    }
  }

  return (
    <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">Una vista general del rendimiento de tu negocio hoy.</p>
                
                {/* Indicador de rol y restricciones */}
                <div className="flex items-center gap-2 mt-2">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isOwner() ? 'bg-purple-100 text-purple-800' :
                        isAdmin() ? 'bg-blue-100 text-blue-800' :
                        isManager() ? 'bg-green-100 text-green-800' : 
                        'bg-gray-100 text-gray-800'
                    }`}>
                        {userRole?.toUpperCase()}
                    </div>
                    
                    {isManager() && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                            <Lock className="h-3 w-3" />
                            Limitado a tu sucursal
                        </div>
                    )}
                    
                    {(isOwner() || isAdmin()) && (
                        <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                            <Users className="h-3 w-3" />
                            Acceso completo
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select 
                    value={selectedBranch} 
                    onValueChange={(value) => {
                        // Managers solo pueden ver su propia sucursal
                        if (isManager() && userBranchId && value !== userBranchId && value !== 'all') {
                            toast({
                                title: 'Acceso Restringido',
                                description: 'Solo puedes ver los datos de tu sucursal asignada.',
                                variant: 'destructive'
                            });
                            return;
                        }
                        setSelectedBranch(value);
                    }}
                    disabled={isManager()} // Deshabilitar selector para managers
                >
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filtrar por sucursal" />
                    </SelectTrigger>
                    <SelectContent>
                        {/* Owner y Admin pueden ver todas las sucursales */}
                        {(isOwner() || isAdmin()) && (
                            <SelectItem value="all">Todas las Sucursales</SelectItem>
                        )}
                        {branches
                            .filter(branch => {
                                // Managers solo ven su sucursal
                                if (isManager()) {
                                    return branch.id === userBranchId;
                                }
                                // Owner y Admin ven todas
                                return true;
                            })
                            .map(branch => (
                                <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                            ))
                        }
                    </SelectContent>
                </Select>
            </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas de Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/{kpis.totalSales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {kpis.transactions} transacciones completadas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/{kpis.avgTicket.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Por transacción hoy
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Depósitos Pendientes</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/{kpis.totalDeposits.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {kpis.pendingDeposits} reservas con adelanto
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado de Caja</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cashSession?.status === 'open' ? 'Abierta' : 'Cerrada'}
            </div>
            <p className="text-xs text-muted-foreground">
              {cashSession?.status === 'open' 
                ? `Desde ${new Date(cashSession.openTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                : 'Sesión no activa'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Ventas de la Semana</CardTitle>
            <CardDescription>Rendimiento de ventas de los últimos 7 días.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={{}} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `S/${value}`} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Métodos de Pago (Hoy)</CardTitle>
            <CardDescription>Distribución de los métodos de pago utilizados.</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentDist.length > 0 ? (
              <ChartContainer config={{}} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                          <Pie data={paymentDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                              const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                              const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                              return (
                                  <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central">
                                      {`${(percent * 100).toFixed(0)}%`}
                                  </text>
                              );
                          }}>
                              {paymentDist.map((entry, index) => (
                                  <Cell key={`cell-${entry.name}`} fill={entry.color} />
                              ))}
                          </Pie>
                          <Legend />
                      </PieChart>
                  </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay ventas hoy
              </div>
            )}
          </CardContent>
        </Card>
      </div>

       <Card>
          <CardHeader>
            <CardTitle>Top 5 Productos Más Vendidos (Hoy)</CardTitle>
            <CardDescription>Los productos que más han vendido durante el día de hoy.</CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Unidades Vendidas</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {topProducts.map(item => (
                          <TableRow key={item.sku}>
                              <TableCell className="font-mono">{item.sku}</TableCell>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="font-bold text-right">{item.units}</TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No se han vendido productos hoy
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  )
}
