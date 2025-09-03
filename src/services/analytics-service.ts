import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export interface ProfitabilityData {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
  transactions: number;
}

export interface BranchComparison {
  branchId: string;
  branchName: string;
  sales: number;
  transactions: number;
  avgTicket: number;
  profitMargin: number;
  topProduct: string;
  growth: number;
}

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  avgPurchaseFrequency: number;
  avgCustomerValue: number;
  customerRetentionRate: number;
}

/**
 * Calcula la rentabilidad basada en ventas y costos de productos
 */
export async function calculateProfitability(
  accountId: string, 
  branchId?: string,
  fromDate?: Date,
  toDate?: Date
): Promise<ProfitabilityData> {
  const from = fromDate || startOfDay(new Date());
  const to = toDate || endOfDay(new Date());
  
  try {
    // Obtener ventas del período
    let salesQuery = query(
      collection(db, 'sales'),
      where('accountId', '==', accountId),
      where('date', '>=', from.getTime()),
      where('date', '<=', to.getTime())
    );

    if (branchId && branchId !== 'all') {
      salesQuery = query(salesQuery, where('branchId', '==', branchId));
    }

    const salesSnapshot = await getDocs(salesQuery);
    
    let totalRevenue = 0;
    let totalCost = 0;
    let transactions = salesSnapshot.docs.length;
    
    // Obtener productos para calcular costos
    const productsSnapshot = await getDocs(
      query(collection(db, 'products'), where('accountId', '==', accountId))
    );
    
    const productsMap = new Map();
    productsSnapshot.docs.forEach(doc => {
      const product = doc.data();
      productsMap.set(doc.id, product);
    });

    // Calcular revenue y costos
    salesSnapshot.docs.forEach(doc => {
      const sale = doc.data();
      totalRevenue += sale.total || 0;
      
      // Calcular costo basado en items vendidos
      (sale.items || []).forEach((item: any) => {
        const product = productsMap.get(item.id);
        if (product && product.costPrice) {
          totalCost += (product.costPrice * (item.quantity || 0));
        } else {
          // Si no hay costPrice definido, usar un porcentaje estimado del precio de venta
          // Esto evita el 100% de margen cuando no hay datos de costo
          const estimatedCost = (item.price || 0) * 0.7; // Asumimos 30% de margen por defecto
          totalCost += (estimatedCost * (item.quantity || 0));
        }
      });
    });

    const grossProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCost,
      grossProfit,
      profitMargin,
      transactions
    };
  } catch (error) {
    console.error('Error calculating profitability:', error);
    return {
      totalRevenue: 0,
      totalCost: 0,
      grossProfit: 0,
      profitMargin: 0,
      transactions: 0
    };
  }
}

/**
 * Obtiene comparación entre sucursales
 */
export async function getBranchComparison(
  accountId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<BranchComparison[]> {
  const from = fromDate || startOfDay(new Date());
  const to = toDate || endOfDay(new Date());
  const previousFrom = subDays(from, 7);
  const previousTo = subDays(to, 7);
  
  try {
    // Obtener sucursales
    const branchesSnapshot = await getDocs(
      query(collection(db, 'branches'), where('accountId', '==', accountId))
    );
    
    const branches = branchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Obtener ventas del período actual
    const currentSalesSnapshot = await getDocs(
      query(
        collection(db, 'sales'),
        where('accountId', '==', accountId),
        where('date', '>=', from.getTime()),
        where('date', '<=', to.getTime())
      )
    );

    // Obtener ventas del período anterior
    const previousSalesSnapshot = await getDocs(
      query(
        collection(db, 'sales'),
        where('accountId', '==', accountId),
        where('date', '>=', previousFrom.getTime()),
        where('date', '<=', previousTo.getTime())
      )
    );

    const currentSales = currentSalesSnapshot.docs.map(doc => doc.data());
    const previousSales = previousSalesSnapshot.docs.map(doc => doc.data());

    // Procesar datos por sucursal
    const branchData: BranchComparison[] = [];

    for (const branch of branches) {
      const branchCurrentSales = currentSales.filter(s => s.branchId === branch.id);
      const branchPreviousSales = previousSales.filter(s => s.branchId === branch.id);
      
      const currentTotal = branchCurrentSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const previousTotal = branchPreviousSales.reduce((sum, s) => sum + (s.total || 0), 0);
      
      const transactions = branchCurrentSales.length;
      const avgTicket = transactions > 0 ? currentTotal / transactions : 0;
      const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

      // Calcular rentabilidad de la sucursal
      const profitData = await calculateProfitability(accountId, branch.id, from, to);
      
      // Obtener producto más vendido
      const productCounts: Record<string, { name: string; count: number }> = {};
      branchCurrentSales.forEach(sale => {
        (sale.items || []).forEach((item: any) => {
          const key = item.id;
          if (!productCounts[key]) {
            productCounts[key] = { name: item.name, count: 0 };
          }
          productCounts[key].count += item.quantity || 0;
        });
      });
      
      const topProduct = Object.values(productCounts)
        .sort((a, b) => b.count - a.count)[0]?.name || 'N/A';

      branchData.push({
        branchId: branch.id,
        branchName: branch.name,
        sales: currentTotal,
        transactions,
        avgTicket,
        profitMargin: profitData.profitMargin,
        topProduct,
        growth
      });
    }

    return branchData.sort((a, b) => b.sales - a.sales);
  } catch (error) {
    console.error('Error getting branch comparison:', error);
    return [];
  }
}

/**
 * Calcula métricas de clientes
 */
export async function getCustomerMetrics(
  accountId: string,
  branchId?: string,
  fromDate?: Date,
  toDate?: Date
): Promise<CustomerMetrics> {
  const from = fromDate || startOfDay(new Date());
  const to = toDate || endOfDay(new Date());
  const monthAgo = subDays(from, 30);
  
  try {
    // Obtener ventas del período
    let salesQuery = query(
      collection(db, 'sales'),
      where('accountId', '==', accountId),
      where('date', '>=', from.getTime()),
      where('date', '<=', to.getTime())
    );

    if (branchId && branchId !== 'all') {
      salesQuery = query(salesQuery, where('branchId', '==', branchId));
    }

    const salesSnapshot = await getDocs(salesQuery);
    const currentSales = salesSnapshot.docs.map(doc => doc.data());

    // Obtener ventas del mes anterior
    let previousSalesQuery = query(
      collection(db, 'sales'),
      where('accountId', '==', accountId),
      where('date', '>=', monthAgo.getTime()),
      where('date', '<', from.getTime())
    );

    if (branchId && branchId !== 'all') {
      previousSalesQuery = query(previousSalesQuery, where('branchId', '==', branchId));
    }

    const previousSalesSnapshot = await getDocs(previousSalesQuery);
    const previousSales = previousSalesSnapshot.docs.map(doc => doc.data());

    // Analizar clientes únicos
    const currentCustomers = new Set();
    const previousCustomers = new Set();
    const customerPurchases: Record<string, { count: number; total: number }> = {};

    currentSales.forEach(sale => {
      if (sale.customerId) {
        currentCustomers.add(sale.customerId);
        if (!customerPurchases[sale.customerId]) {
          customerPurchases[sale.customerId] = { count: 0, total: 0 };
        }
        customerPurchases[sale.customerId].count += 1;
        customerPurchases[sale.customerId].total += sale.total || 0;
      }
    });

    previousSales.forEach(sale => {
      if (sale.customerId) {
        previousCustomers.add(sale.customerId);
      }
    });

    const totalCustomers = currentCustomers.size;
    const returningCustomers = Array.from(currentCustomers)
      .filter(id => previousCustomers.has(id)).length;
    const newCustomers = totalCustomers - returningCustomers;

    const avgPurchaseFrequency = totalCustomers > 0 ? 
      Object.values(customerPurchases).reduce((sum, c) => sum + c.count, 0) / totalCustomers : 0;
    
    const avgCustomerValue = totalCustomers > 0 ? 
      Object.values(customerPurchases).reduce((sum, c) => sum + c.total, 0) / totalCustomers : 0;

    const customerRetentionRate = previousCustomers.size > 0 ? 
      (returningCustomers / previousCustomers.size) * 100 : 0;

    return {
      totalCustomers,
      newCustomers,
      returningCustomers,
      avgPurchaseFrequency,
      avgCustomerValue,
      customerRetentionRate
    };
  } catch (error) {
    console.error('Error calculating customer metrics:', error);
    return {
      totalCustomers: 0,
      newCustomers: 0,
      returningCustomers: 0,
      avgPurchaseFrequency: 0,
      avgCustomerValue: 0,
      customerRetentionRate: 0
    };
  }
}

/**
 * Obtiene alertas y recomendaciones
 */
export async function getBusinessAlerts(accountId: string, branchId?: string) {
  try {
    const alerts = [];
    
    // Verificar stock bajo
    const lowStockQuery = query(
      collection(db, 'products'),
      where('accountId', '==', accountId),
      where('stock', '<', 5)
    );
    
    if (branchId && branchId !== 'all') {
      // Filtrar por sucursal si es necesario
    }
    
    const lowStockSnapshot = await getDocs(lowStockQuery);
    if (!lowStockSnapshot.empty) {
      alerts.push({
        type: 'warning',
        title: 'Stock Bajo',
        message: `${lowStockSnapshot.size} productos con stock crítico`,
        action: 'Revisar inventario'
      });
    }

    // Verificar rentabilidad baja
    const profitability = await calculateProfitability(accountId, branchId);
    if (profitability.profitMargin < 20) {
      alerts.push({
        type: 'error',
        title: 'Margen Bajo',
        message: `Margen de ganancia: ${profitability.profitMargin.toFixed(1)}%`,
        action: 'Revisar precios'
      });
    }

    return alerts;
  } catch (error) {
    console.error('Error getting business alerts:', error);
    return [];
  }
}
