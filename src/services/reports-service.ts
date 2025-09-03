import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';

export interface CashClosureReport {
  id: string;
  branchId: string;
  branchName?: string;
  from: number;
  to: number;
  createdAt: number;
  totalsByMethod: Record<string, number>;
  transactions: number;
  total: number;
  accountId: string;
}

/**
 * Obtiene todos los reportes Z de una cuenta
 */
export async function getCashClosureReports(
  accountId: string,
  branchId?: string,
  limit: number = 50
): Promise<CashClosureReport[]> {
  try {
    let reportsQuery = query(
      collection(db, 'cash_closures'),
      where('accountId', '==', accountId),
      orderBy('createdAt', 'desc')
    );

    if (branchId && branchId !== 'all') {
      reportsQuery = query(reportsQuery, where('branchId', '==', branchId));
    }

    const snapshot = await getDocs(reportsQuery);
    
    // Obtener nombres de sucursales
    const branchesSnapshot = await getDocs(
      query(collection(db, 'branches'), where('accountId', '==', accountId))
    );
    
    const branchNames = new Map();
    branchesSnapshot.docs.forEach(doc => {
      branchNames.set(doc.id, doc.data().name);
    });

    const reports: CashClosureReport[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      branchName: branchNames.get(doc.data().branchId) || 'Sucursal desconocida'
    })) as CashClosureReport[];

    return reports.slice(0, limit);
  } catch (error) {
    console.error('Error fetching cash closure reports:', error);
    return [];
  }
}

/**
 * Obtiene un reporte específico por ID
 */
export async function getCashClosureReport(reportId: string): Promise<CashClosureReport | null> {
  try {
    const docRef = doc(db, 'cash_closures', reportId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    
    // Obtener nombre de sucursal
    if (data.branchId) {
      const branchDoc = await getDoc(doc(db, 'branches', data.branchId));
      if (branchDoc.exists()) {
        data.branchName = branchDoc.data().name;
      }
    }

    return {
      id: docSnap.id,
      ...data
    } as CashClosureReport;
  } catch (error) {
    console.error('Error fetching cash closure report:', error);
    return null;
  }
}

/**
 * Formatea un reporte para imprimir o exportar
 */
export function formatReportForPrint(report: CashClosureReport): string {
  const startDate = format(new Date(report.from), 'dd/MM/yyyy HH:mm');
  const endDate = format(new Date(report.to), 'dd/MM/yyyy HH:mm');
  const createdDate = format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm');

  let content = `
==========================================
           REPORTE Z - CIERRE DE CAJA
==========================================

Sucursal: ${report.branchName}
Período: ${startDate} - ${endDate}
Generado: ${createdDate}
ID Reporte: ${report.id}

==========================================
              RESUMEN DE VENTAS
==========================================

Total de Transacciones: ${report.transactions}
Total de Ventas: S/${report.total.toFixed(2)}

==========================================
         DESGLOSE POR MÉTODO DE PAGO
==========================================

`;

  // Añadir métodos de pago
  Object.entries(report.totalsByMethod).forEach(([method, amount]) => {
    const methodName = method === 'cash' ? 'Efectivo' : 
                      method === 'card' ? 'Tarjeta' : 
                      method === 'transfer' ? 'Transferencia' : method;
    content += `${methodName.padEnd(20)}: S/${amount.toFixed(2)}\n`;
  });

  content += `
==========================================
                   TOTAL
==========================================

TOTAL GENERAL: S/${report.total.toFixed(2)}

==========================================
`;

  return content;
}
