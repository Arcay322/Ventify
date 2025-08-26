"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar as CalendarIcon, Download } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const salesReportData = [
    { date: "2023-05-01", sales: 22, revenue: 2150.50 },
    { date: "2023-05-02", sales: 35, revenue: 3200.00 },
    { date: "2023-05-03", sales: 28, revenue: 2800.75 },
    { date: "2023-05-04", sales: 42, revenue: 4100.25 },
    { date: "2023-05-05", sales: 39, revenue: 3950.00 },
    { date: "2023-05-06", sales: 55, revenue: 5800.00 },
    { date: "2023-05-07", sales: 48, revenue: 4900.50 },
];

export default function ReportsPage() {
    const [date, setDate] = useState<Date | undefined>()

    useEffect(() => {
        setDate(new Date())
    }, [])

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Informes de Ventas</h1>
                <div className="flex items-center gap-4">
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-[280px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                initialFocus
                                locale={es}
                            />
                        </PopoverContent>
                    </Popover>
                    <Button style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                        <Download className="mr-2 h-4 w-4" /> Exportar Informe
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Tendencia de Ventas</CardTitle>
                    <CardDescription>Ingresos durante el período seleccionado.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={{}} className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={salesReportData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('es-ES', {day:'numeric', month:'short'})} />
                                <YAxis yAxisId="left" tickFormatter={(value) => `S/${value/1000}k`} />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <Legend />
                                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" name="Ingresos (S/)" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Informe Detallado</CardTitle>
                    <CardDescription>Desglose diario de ventas e ingresos.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Ventas Totales</TableHead>
                                <TableHead className="text-right">Ingresos</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {salesReportData.map((row, index) => (
                                <TableRow key={index}>
                                    <TableCell>{format(new Date(row.date), "PPP", { locale: es })}</TableCell>
                                    <TableCell>{row.sales}</TableCell>
                                    <TableCell className="text-right">S/{row.revenue.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
