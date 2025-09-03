"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Download, Eye, Filter, Calendar } from "lucide-react";
import { format } from 'date-fns';
import { getBranches } from '@/services/branch-service';
import { getCashClosureReports, formatReportForPrint, type CashClosureReport } from '@/services/reports-service';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function ReportsPage() {
  const { canAccessDashboard, isManager, userBranchId } = usePermissions();
  const authState = useAuth();
  const { toast } = useToast();

  const [reports, setReports] = useState<CashClosureReport[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<CashClosureReport | null>(null);

  // Cargar sucursales
  useEffect(() => {
    const accountId = authState.userDoc?.accountId as string | undefined;
    if (!accountId) return;

    const unsubBranches = getBranches(setBranches, accountId);
    return () => unsubBranches();
  }, [authState.userDoc?.accountId]);

  // Para managers, establecer automáticamente su sucursal
  useEffect(() => {
    if (isManager() && userBranchId && selectedBranch === 'all') {
      setSelectedBranch(userBranchId);
    }
  }, [isManager, userBranchId, selectedBranch]);

  // Cargar reportes
  useEffect(() => {
    const loadReports = async () => {
      const accountId = authState.userDoc?.accountId as string | undefined;
      if (!accountId) return;

      setLoading(true);
      try {
        const branchId = selectedBranch === 'all' ? undefined : selectedBranch;
        const fetchedReports = await getCashClosureReports(accountId, branchId);
        setReports(fetchedReports);
      } catch (error) {
        console.error('Error loading reports:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los reportes',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [authState.userDoc?.accountId, selectedBranch, toast]);

  // Filtrar branches para managers
  const filteredBranches = branches.filter(branch => {
    if (isManager()) {
      return branch.id === userBranchId;
    }
    return true;
  });

  const handleDownloadReport = (report: CashClosureReport) => {
    const content = formatReportForPrint(report);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-z-${report.branchName}-${format(new Date(report.createdAt), 'yyyy-MM-dd-HHmm')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!canAccessDashboard()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <FileText className="h-16 w-16 text-orange-500" />
        <h2 className="text-2xl font-bold text-gray-900">Acceso Denegado</h2>
        <p className="text-gray-600 text-center max-w-md">
          No tienes permisos para acceder a los reportes.
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
          <h1 className="text-3xl font-bold tracking-tight">Reportes Z</h1>
          <p className="text-muted-foreground">Cierres de caja y reportes generados.</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={isManager()}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por sucursal" />
            </SelectTrigger>
            <SelectContent>
              {!isManager() && (
                <SelectItem value="all">Todas las Sucursales</SelectItem>
              )}
              {filteredBranches.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Reportes de Cierre de Caja
          </CardTitle>
          <CardDescription>
            Historial de reportes Z generados para el cierre de caja
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Cargando reportes...</p>
            </div>
          ) : reports.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Transacciones</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map(report => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {format(new Date(report.createdAt), 'dd/MM/yyyy')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(report.createdAt), 'HH:mm')}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{report.branchName}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>
                          Desde: {format(new Date(report.from), 'dd/MM HH:mm')}
                        </div>
                        <div>
                          Hasta: {format(new Date(report.to), 'dd/MM HH:mm')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {report.transactions}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      S/{report.total.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-center">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedReport(report)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Reporte Z - {report.branchName}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Fecha de Generación:</label>
                                  <p>{format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">ID del Reporte:</label>
                                  <p className="font-mono text-sm">{report.id}</p>
                                </div>
                              </div>
                              
                              <div>
                                <label className="text-sm font-medium">Período del Reporte:</label>
                                <p>
                                  {format(new Date(report.from), 'dd/MM/yyyy HH:mm')} - {' '}
                                  {format(new Date(report.to), 'dd/MM/yyyy HH:mm')}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <Card>
                                  <CardContent className="pt-4">
                                    <div className="text-center">
                                      <div className="text-2xl font-bold">{report.transactions}</div>
                                      <div className="text-sm text-muted-foreground">Transacciones</div>
                                    </div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardContent className="pt-4">
                                    <div className="text-center">
                                      <div className="text-2xl font-bold">S/{report.total.toFixed(2)}</div>
                                      <div className="text-sm text-muted-foreground">Total Ventas</div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>

                              <div>
                                <label className="text-sm font-medium mb-2 block">Métodos de Pago:</label>
                                <div className="space-y-2">
                                  {Object.entries(report.totalsByMethod).map(([method, amount]) => (
                                    <div key={method} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                      <span className="font-medium">
                                        {method === 'cash' ? 'Efectivo' : 
                                         method === 'card' ? 'Tarjeta' : 
                                         method === 'transfer' ? 'Transferencia' : method}
                                      </span>
                                      <span className="font-bold">S/{amount.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadReport(report)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay reportes disponibles</h3>
              <p className="text-muted-foreground mb-4">
                Los reportes Z aparecerán aquí cuando generes cierres de caja desde el dashboard.
              </p>
              <Button asChild>
                <Link href="/dashboard">Ir al Dashboard</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
