"use client"

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line, ResponsiveContainer } from "recharts";
import { DollarSign, Package, Users, ShoppingCart, Filter, Lock, AlertTriangle, TrendingUp, TrendingDown, Clock, Package2, Percent, Building2, UserCheck, Zap, RefreshCw, FileText, Settings, Target } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBranches } from '@/services/branch-service';
import { getSales } from '@/services/sales-service';
import { ReservationDepositService } from '@/services/reservation-deposit-service';
import { getActiveSession, getAllActiveSessions } from '@/services/cash-register-service';
import { getLowStockProducts } from '@/services/product-service';
import { calculateProfitability, getBranchComparison, getCustomerMetrics, getBusinessAlerts, type ProfitabilityData, type BranchComparison, type CustomerMetrics } from '@/services/analytics-service';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { subDays, startOfDay, endOfDay, formatISO } from 'date-fns';

export default function DashboardPage() {
  // TODOS los hooks deben ir ANTES de cualquier return condicional
  const { canAccessDashboard, isOwner, isAdmin, isManager, userRole, userBranchId } = usePermissions();
  const authState = useAuth();
  const { toast } = useToast();
  
  // Estados
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [branches, setBranches] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [reservationDeposits, setReservationDeposits] = useState<any[]>([]);
  const [cashSession, setCashSession] = useState<any>(null);
  const [allCashSessions, setAllCashSessions] = useState<any[]>([]); // Para resumen de todas las sucursales
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [previousPeriodSales, setPreviousPeriodSales] = useState({ yesterday: 0, lastWeek: 0 });
  
  // Nuevos estados para Fase 2
  const [profitabilityData, setProfitabilityData] = useState<ProfitabilityData>({
    totalRevenue: 0,
    totalCost: 0,
    grossProfit: 0,
    profitMargin: 0,
    transactions: 0
  });
  const [branchComparison, setBranchComparison] = useState<BranchComparison[]>([]);
  const [customerMetrics, setCustomerMetrics] = useState<CustomerMetrics>({
    totalCustomers: 0,
    newCustomers: 0,
    returningCustomers: 0,
    avgPurchaseFrequency: 0,
    avgCustomerValue: 0,
    customerRetentionRate: 0
  });
  const [businessAlerts, setBusinessAlerts] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
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

  // Funciones auxiliares definidas fuera de useEffect para evitar dependencias
  const loadComparisonData = useCallback(() => {
    if (!sales.length) return;

    // Ventas de ayer
    const yesterday = subDays(new Date(), 1);
    const yesterdayStart = startOfDay(yesterday).getTime();
    const yesterdayEnd = endOfDay(yesterday).getTime();
    
    const yesterdaySales = sales.filter(s => 
      (s.date || 0) >= yesterdayStart && (s.date || 0) <= yesterdayEnd
    );
    const yesterdayTotal = yesterdaySales.reduce((a, b) => a + (b.total || 0), 0);

    // Ventas de la semana pasada (mismo día)
    const lastWeek = subDays(new Date(), 7);
    const lastWeekStart = startOfDay(lastWeek).getTime();
    const lastWeekEnd = endOfDay(lastWeek).getTime();
    
    const lastWeekSales = sales.filter(s => 
      (s.date || 0) >= lastWeekStart && (s.date || 0) <= lastWeekEnd
    );
    const lastWeekTotal = lastWeekSales.reduce((a, b) => a + (b.total || 0), 0);

    setPreviousPeriodSales({
      yesterday: yesterdayTotal,
      lastWeek: lastWeekTotal
    });
  }, [sales]);

  const loadHourlyData = useCallback(() => {
    if (!sales.length) return;

    const today = new Date();
    const todayStart = startOfDay(today).getTime();
    const todayEnd = endOfDay(today).getTime();

    const todaySales = sales.filter(s => (s.date || 0) >= todayStart && (s.date || 0) <= todayEnd);

    // Agrupar por hora
    const hourlyMap: Record<number, number> = {};
    todaySales.forEach(sale => {
      const hour = new Date(sale.date || 0).getHours();
      hourlyMap[hour] = (hourlyMap[hour] || 0) + (sale.total || 0);
    });

    // Crear array de 24 horas
    const hourlyArray = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      sales: hourlyMap[hour] || 0
    }));

    // Solo mostrar las últimas 12 horas con actividad o desde las 8 AM
    const currentHour = new Date().getHours();
    const startHour = Math.max(8, currentHour - 11);
    const relevantHours = hourlyArray.slice(startHour, currentHour + 1);
    
    setHourlyData(relevantHours);
  }, [sales]);

  // Nueva función para cargar datos de analytics (Fase 2)
  const loadAnalyticsData = useCallback(async () => {
    if (!authState.userDoc?.accountId) return;
    
    setLoadingAnalytics(true);
    const accountId = authState.userDoc.accountId;
    const branchId = selectedBranch === 'all' ? undefined : selectedBranch;
    
    try {
      // Cargar datos en paralelo
      const [profitability, comparison, customerData, alerts] = await Promise.all([
        calculateProfitability(accountId, branchId),
        (userRole === 'owner' || userRole === 'admin') ? getBranchComparison(accountId) : Promise.resolve([]),
        getCustomerMetrics(accountId, branchId),
        getBusinessAlerts(accountId, branchId)
      ]);

      setProfitabilityData(profitability);
      setBranchComparison(comparison);
      setCustomerMetrics(customerData);
      setBusinessAlerts(alerts);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar algunos datos analíticos',
        variant: 'destructive'
      });
    } finally {
      setLoadingAnalytics(false);
    }
  }, [authState.userDoc?.accountId, selectedBranch, userRole, toast]);
  useEffect(() => {
    // Para managers, establecer automáticamente su sucursal solo una vez
    if (isManager() && userBranchId && selectedBranch === 'all') {
      setSelectedBranch(userBranchId);
    }
  }, [isManager, userBranchId]); // No incluir selectedBranch aquí para evitar loops

  // useEffect para cargar datos
  useEffect(() => {
    const accountId = authState.userDoc?.accountId as string | undefined;
    if (!accountId) return;

    // Cargar sucursales
    const unsubBranches = getBranches(setBranches, accountId);
    
    // Cargar ventas  
    const unsubSales = getSales((s) => setSales(s), accountId);

    // Cargar depósitos de reservas activos
    const loadReservationDeposits = async () => {
      if (selectedBranch && selectedBranch !== 'all') {
        const deposits = await ReservationDepositService.getActiveDeposits(selectedBranch, accountId);
        setReservationDeposits(deposits);
      } else if (selectedBranch === 'all') {
        // Obtener depósitos de todas las sucursales
        const deposits = await ReservationDepositService.getAllActiveDeposits(accountId);
        setReservationDeposits(deposits);
      } else {
        setReservationDeposits([]);
      }
    };

    // Cargar sesión de caja activa
    const loadCashSession = async () => {
      if (selectedBranch && selectedBranch !== 'all') {
        try {
          const session = await getActiveSession(selectedBranch, accountId);
          setCashSession(session);
          setAllCashSessions([]); // Limpiar sesiones múltiples
        } catch (error) {
          console.error('Error loading cash session:', error);
          setCashSession(null);
          setAllCashSessions([]);
        }
      } else if (selectedBranch === 'all') {
        try {
          const sessions = await getAllActiveSessions(accountId);
          setAllCashSessions(sessions);
          setCashSession(null); // Limpiar sesión individual
        } catch (error) {
          console.error('Error loading all sessions:', error);
          setAllCashSessions([]);
          setCashSession(null);
        }
      } else {
        setCashSession(null);
        setAllCashSessions([]);
      }
    };

    // Cargar productos con stock bajo
    const loadLowStockProducts = async () => {
      if (accountId) {
        try {
          const products = await getLowStockProducts(accountId, 5); // Threshold de 5 unidades
          // Filtrar por sucursal si es necesario
          if (selectedBranch && selectedBranch !== 'all') {
            const filtered = products.filter(p => p.branchId === selectedBranch);
            setLowStockProducts(filtered);
          } else {
            setLowStockProducts(products);
          }
        } catch (error) {
          console.error('Error loading low stock products:', error);
          setLowStockProducts([]);
        }
      }
    };

    loadReservationDeposits();
    loadCashSession();
    loadLowStockProducts();

    return () => {
      unsubBranches();
      unsubSales();
    };
  }, [authState.userDoc?.accountId, selectedBranch]); // Removemos sales para evitar bucle infinito

  // useEffect separado para cálculos que dependen de sales
  useEffect(() => {
    if (sales.length > 0) {
      loadComparisonData();
      loadHourlyData();
    }
  }, [sales, loadComparisonData, loadHourlyData]);

  // useEffect separado para analytics data con debounce para evitar spam
  useEffect(() => {
    if (authState.userDoc?.accountId && sales.length > 0) {
      const timeoutId = setTimeout(() => {
        loadAnalyticsData();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [selectedBranch, authState.userDoc?.accountId, sales.length]);

  // useEffect para calcular KPIs y datos de gráficos
  useEffect(() => {
    if (!sales.length && !reservationDeposits.length) return;

    // Filtrar por sucursal
    const filtered = selectedBranch === 'all' 
      ? sales 
      : sales.filter(s => s.branchId === selectedBranch);

    // Solo ventas de hoy
    const today = new Date();
    const startToday = startOfDay(today).getTime();
    const endToday = endOfDay(today).getTime();
    const todaySales = filtered.filter(s => (s.date || 0) >= startToday && (s.date || 0) <= endToday);
    
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

    // Top products
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

  // Memoizar branches filtradas para evitar re-renders
  const filteredBranches = useMemo(() => {
    return branches.filter(branch => {
      if (isManager()) {
        return branch.id === userBranchId;
      }
      return true;
    });
  }, [branches, isManager, userBranchId]);

  // Función auxiliar
  const generateZReport = async (branchId = selectedBranch, from = startOfDay(new Date()).getTime(), to = endOfDay(new Date()).getTime()) => {
    try {
      if (!authState.userDoc?.accountId) {
        toast({ title: 'Error', description: 'No se pudo obtener la información de la cuenta', variant: 'destructive' });
        return;
      }

      const filtered = sales.filter(s => (branchId === 'all' ? true : s.branchId === branchId) && (s.date || 0) >= from && (s.date || 0) <= to);
      const totalsByMethod: Record<string, number> = {};
      filtered.forEach(s => { 
        totalsByMethod[s.paymentMethod || 'Unknown'] = (totalsByMethod[s.paymentMethod || 'Unknown'] || 0) + (s.total || 0); 
      });
      
      const doc = await addDoc(collection(db, 'cash_closures'), {
        accountId: authState.userDoc.accountId,
        branchId,
        from,
        to,
        createdAt: Date.now(),
        createdBy: authState.user?.uid,
        totalsByMethod,
        transactions: filtered.length,
        total: filtered.reduce((a, b) => a + (b.total || 0), 0),
        reportType: 'Z',
        period: {
          start: new Date(from).toISOString(),
          end: new Date(to).toISOString()
        }
      });
      
      toast({ 
        title: 'Reporte Z generado', 
        description: `ID: ${doc.id.substring(0, 8)}...` 
      });
    } catch (err) {
      console.error('Z report error', err);
      toast({ 
        title: 'Error', 
        description: 'No se pudo generar el reporte Z', 
        variant: 'destructive' 
      });
    }
  };

  // Funciones de acciones rápidas (Fase 2)
  const quickActions = [
    {
      title: 'Generar Reporte Z',
      description: 'Cierre de caja diario',
      icon: FileText,
      color: 'bg-blue-500',
      action: () => generateZReport()
    },
    {
      title: 'Ver Reportes',
      description: 'Historial de reportes',
      icon: FileText,
      color: 'bg-indigo-500',
      action: () => window.location.href = '/reports'
    },
    {
      title: 'Actualizar Datos',
      description: 'Refrescar dashboard',
      icon: RefreshCw,
      color: 'bg-green-500',
      action: () => loadAnalyticsData()
    },
    {
      title: 'Ver Inventario',
      description: 'Gestión de productos',
      icon: Package2,
      color: 'bg-purple-500',
      action: () => window.location.href = '/products'
    }
  ];

  // Verificación de acceso DESPUÉS de todos los hooks
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
            disabled={isManager()}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por sucursal" />
            </SelectTrigger>
            <SelectContent>
              {(isOwner() || isAdmin()) && (
                <SelectItem value="all">Todas las Sucursales</SelectItem>
              )}
              {filteredBranches.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* KPIs mejorados con rentabilidad (Fase 2) */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas de Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/{kpis.totalSales.toFixed(2)}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <span>{kpis.transactions} transacciones</span>
              {previousPeriodSales.yesterday > 0 && (
                <span className="ml-2 flex items-center">
                  {kpis.totalSales > previousPeriodSales.yesterday ? (
                    <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                  ) : kpis.totalSales < previousPeriodSales.yesterday ? (
                    <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                  ) : null}
                  {previousPeriodSales.yesterday > 0 && 
                    `${((kpis.totalSales - previousPeriodSales.yesterday) / previousPeriodSales.yesterday * 100).toFixed(0)}% vs ayer`
                  }
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Nuevo KPI: Margen de Ganancia */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen de Ganancia</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              profitabilityData.profitMargin >= 30 ? 'text-green-600' : 
              profitabilityData.profitMargin >= 20 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {profitabilityData.profitMargin.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              S/{profitabilityData.grossProfit.toFixed(2)} ganancia bruta
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
              Por transacción
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Depósitos de Reservas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/{kpis.totalDeposits.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {kpis.pendingDeposits} reservas pendientes{selectedBranch === 'all' ? ' (todas las sucursales)' : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado de Caja</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedBranch === 'all' ? (
                // Resumen de todas las sucursales
                allCashSessions.length > 0 ? (
                  <span className="text-blue-600">{allCashSessions.length} Abiertas</span>
                ) : (
                  <span className="text-gray-600">Todas Cerradas</span>
                )
              ) : (
                // Sucursal específica
                cashSession ? (
                  <span className="text-green-600">Abierta</span>
                ) : (
                  <span className="text-red-600">Cerrada</span>
                )
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedBranch === 'all' ? (
                allCashSessions.length > 0 ? 
                  `${allCashSessions.length} de ${filteredBranches.length} sucursales con caja abierta` : 
                  'Ninguna sucursal tiene caja abierta'
              ) : (
                cashSession ? `Desde: ${new Date(cashSession.openTime?.seconds ? cashSession.openTime.seconds * 1000 : Date.now()).toLocaleDateString('es-PE')} ${new Date(cashSession.openTime?.seconds ? cashSession.openTime.seconds * 1000 : Date.now()).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}` : 'Sin sesión activa'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Ventas de la Semana</CardTitle>
            <CardDescription>Rendimiento de ventas de los últimos 7 días.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={{}} className="h-[300px] w-full">
              <BarChart data={weeklyData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `S/${value}`} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
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
                <PieChart>
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                  <Pie data={paymentDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
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
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay ventas hoy
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top productos */}
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Productos Más Vendidos (Hoy)</CardTitle>
            <CardDescription>Ranking de productos por unidades vendidas.</CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
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

      {/* Nueva sección: Alertas y gráficos adicionales */}
      <div className="grid gap-4 md:grid-cols-2">
        
        {/* Productos con Stock Bajo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Stock Crítico
            </CardTitle>
            <CardDescription>Productos con menos de 5 unidades</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {lowStockProducts.slice(0, 10).map((product, index) => (
                  <div key={`${product.id}-${product.branchId}`} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-3">
                      <Package2 className="h-4 w-4 text-orange-500" />
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {branches.find(b => b.id === product.branchId)?.name || product.branchId}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold text-sm ${
                        product.availableStock === 0 ? 'text-red-600' : 
                        product.availableStock <= 2 ? 'text-orange-600' : 'text-yellow-600'
                      }`}>
                        {product.availableStock} unid.
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Package2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Todos los productos tienen stock suficiente</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ventas por Hora */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Ventas por Hora (Hoy)
            </CardTitle>
            <CardDescription>Distribución de ventas durante el día</CardDescription>
          </CardHeader>
          <CardContent>
            {hourlyData.length > 0 ? (
              <ChartContainer
                config={{
                  sales: {
                    label: "Ventas",
                    color: "hsl(var(--chart-1))",
                  },
                }}
                className="h-64"
              >
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="sales" fill="var(--color-sales)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay datos de ventas por hora disponibles</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nueva sección: Comparación entre sucursales (Fase 2) - Solo para Owner/Admin */}
      {(isOwner() || isAdmin()) && branchComparison.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Comparativo entre Sucursales
            </CardTitle>
            <CardDescription>Rendimiento de todas las sucursales hoy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {branchComparison.map((branch, index) => (
                <Card key={branch.branchId} className={`relative ${index === 0 ? 'ring-2 ring-green-500' : ''}`}>
                  {index === 0 && (
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                      #1
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{branch.branchName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Ventas:</span>
                      <span className="font-bold">S/{branch.sales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Transacciones:</span>
                      <span>{branch.transactions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Ticket Promedio:</span>
                      <span>S/{branch.avgTicket.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Margen:</span>
                      <span className={`font-medium ${
                        branch.profitMargin >= 30 ? 'text-green-600' : 
                        branch.profitMargin >= 20 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {branch.profitMargin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Top Producto:</span>
                      <span className="text-xs font-medium truncate max-w-24" title={branch.topProduct}>
                        {branch.topProduct}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Crecimiento:</span>
                      <div className="flex items-center">
                        {branch.growth > 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                        ) : branch.growth < 0 ? (
                          <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                        ) : null}
                        <span className={`text-xs font-medium ${
                          branch.growth > 0 ? 'text-green-600' : 
                          branch.growth < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {branch.growth > 0 ? '+' : ''}{branch.growth.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nueva sección: Métricas de clientes (Fase 2) */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-500" />
              Clientes de Hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total de clientes:</span>
              <span className="font-bold text-lg">{customerMetrics.totalCustomers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Clientes nuevos:</span>
              <span className="text-green-600 font-medium">{customerMetrics.newCustomers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Clientes recurrentes:</span>
              <span className="text-blue-600 font-medium">{customerMetrics.returningCustomers}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              Comportamiento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Freq. de compra:</span>
              <span className="font-bold">{customerMetrics.avgPurchaseFrequency.toFixed(1)}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Valor promedio:</span>
              <span className="font-bold">S/{customerMetrics.avgCustomerValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Retención:</span>
              <span className="font-bold text-green-600">
                {customerMetrics.customerRetentionRate.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Nueva sección: Acciones rápidas (Fase 2) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="h-auto p-3 flex flex-col items-center gap-1"
                  onClick={action.action}
                  disabled={loadingAnalytics}
                >
                  <div className={`p-1 rounded ${action.color} bg-opacity-20`}>
                    <action.icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium text-center leading-tight">
                    {action.title}
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas y recomendaciones (Fase 2) */}
      {businessAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Alertas y Recomendaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {businessAlerts.map((alert, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border-l-4 ${
                    alert.type === 'error' ? 'border-red-500 bg-red-50' :
                    alert.type === 'warning' ? 'border-orange-500 bg-orange-50' :
                    'border-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">{alert.title}</h4>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      {alert.action}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
