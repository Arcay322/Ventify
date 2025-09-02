"use client"

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { subscribeSettings, saveSettings } from '@/services/settings-service';
import { ProtectedAdmin } from '@/hooks/use-auth';
import { Loader2, Percent, Users, Settings } from 'lucide-react';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';

const settingsSchema = z.object({
    businessName: z.string().min(1, "El nombre del negocio es requerido."),
    ruc: z.string().min(11, "El RUC debe tener 11 dígitos.").max(11, "El RUC debe tener 11 dígitos."),
    address: z.string().min(1, "La dirección es requerida."),
    taxRate: z.coerce.number().min(0, "El IGV no puede ser negativo.").max(100, "El IGV no puede ser mayor a 100."),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            businessName: 'Ventify',
            ruc: '20123456789',
            address: 'Av. Principal 123, Lima, Perú',
            taxRate: 18,
        }
    });

    useEffect(() => {
        const unsub = subscribeSettings((data) => {
            if (data) {
                const s = data as any; // runtime shape validated in settings-service
                form.reset({ businessName: s.businessName || '', ruc: s.ruc || '', address: s.address || '', taxRate: typeof s.taxRate === 'number' ? s.taxRate : 18 });
            }
        });
        return () => unsub();
    }, []);

    const onSubmit = async (data: SettingsFormValues) => {
        setLoading(true);
        await saveSettings(data);
        toast({ title: 'Configuración Guardada', description: 'La información de tu negocio ha sido actualizada.' });
        setLoading(false);
    };

    return (
        <ProtectedAdmin fallback={<div className="p-6">Acceso denegado</div>}>
        <div className="flex flex-col gap-8">
            <h1 className="text-3xl font-bold tracking-tight">Configuración del Sistema</h1>
            
            {/* Enlaces rápidos a otras configuraciones */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/settings/discounts">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <Percent className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Descuentos y Promociones</h3>
                                    <p className="text-sm text-muted-foreground">Configura límites y promociones</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
                
                <Link href="/users">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Users className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Gestión de Usuarios</h3>
                                    <p className="text-sm text-muted-foreground">Administra roles y permisos</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
                
                <Card className="opacity-50">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-lg">
                                <Settings className="h-5 w-5 text-gray-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold">Configuraciones Avanzadas</h3>
                                <p className="text-sm text-muted-foreground">Próximamente</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Información del Negocio</CardTitle>
                            <CardDescription>Esta información aparecerá en tus notas de pedido, reportes y documentos.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <FormField
                                control={form.control}
                                name="businessName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre del Negocio o Razón Social</FormLabel>
                                        <FormControl>
                                            <Input placeholder="El nombre de tu tienda" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="ruc"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>RUC</FormLabel>
                                        <FormControl>
                                            <Input placeholder="20123456789" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="address"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Dirección Fiscal</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="La dirección de tu tienda" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="taxRate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>IGV (%)</FormLabel>
                                        <FormControl>
                                             <div className="relative">
                                                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">%</span>
                                                <Input type="number" placeholder="18" className="pr-8" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                         <CardFooter className="border-t px-6 py-4">
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Cambios
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        </div>
        </ProtectedAdmin>
    );
}
