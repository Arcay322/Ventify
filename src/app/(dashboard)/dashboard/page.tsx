"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { DollarSign, Package, Users, ShoppingCart, Filter } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockBranches } from "@/lib/mock-data";

const weeklySalesData = [
  { day: 'Lun', sales: 4100 },
  { day: 'Mar', sales: 3200 },
  { day: 'Mié', sales: 2500 },
  { day: 'Jue', sales: 2980 },
  { day: 'Vie', sales: 2190 },
  { day: 'Sáb', sales: 2590 },
  { day: 'Dom', sales: 3890 },
];

const paymentMethodData = [
    { name: 'Tarjeta', value: 400, color: 'hsl(var(--chart-1))' },
    { name: 'Efectivo', value: 300, color: 'hsl(var(--chart-2))' },
    { name: 'Digital', value: 200, color: 'hsl(var(--chart-3))'},
]

const topProductsData = [
    { sku: 'ELEC-001', name: 'Auriculares Inalámbricos', unitsSold: 58 },
    { sku: 'ROPA-002', name: 'Camiseta de Algodón', unitsSold: 45 },
    { sku: 'HGR-003', name: 'Taza de Cerámica', unitsSold: 32 },
    { sku: 'ELEC-004', name: 'Teclado Mecánico', unitsSold: 21 },
    { sku: 'ALIM-009', name: 'Café de Origen', unitsSold: 15 },
]

export default function DashboardPage() {
  const [selectedBranch, setSelectedBranch] = useState('all');

  return (
    <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">Una vista general del rendimiento de tu negocio hoy.</p>
            </div>
            <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filtrar por sucursal" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas las Sucursales</SelectItem>
                        {mockBranches.map(branch => (
                            <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Ventas Totales (Hoy)</CardTitle>
            <CardDescription>Ingresos totales de hoy en todas las transacciones.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">S/ 1,824.50</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ticket Promedio (Hoy)</CardTitle>
            <CardDescription>Valor promedio de cada venta realizada hoy.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">S/ 73.81</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Transacciones (Hoy)</CardTitle>
            <CardDescription>Número total de ventas procesadas hoy.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">42</p>
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
                <BarChart data={weeklySalesData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `S/${value/1000}k`} />
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
            <ChartContainer config={{}} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                        <Pie data={paymentMethodData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                            const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                            const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                            return (
                                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central">
                                    {`${(percent * 100).toFixed(0)}%`}
                                </text>
                            );
                        }}>
                            {paymentMethodData.map((entry) => (
                                <Cell key={`cell-${entry.name}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

       <Card>
          <CardHeader>
            <CardTitle>Top 5 Productos Más Vendidos (Hoy)</CardTitle>
            <CardDescription>Los productos que más han vendido durante el día de hoy.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Unidades Vendidas</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {topProductsData.map(item => (
                        <TableRow key={item.sku}>
                            <TableCell className="font-mono">{item.sku}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="font-bold text-right">{item.unitsSold}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
    </div>
  )
}
