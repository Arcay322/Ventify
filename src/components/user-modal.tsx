"use client"

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { saveUser } from '@/services/user-service';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import type { User, Role } from '@/types/user';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getBranches } from '@/services/branch-service';

const userSchema = z.object({
    name: z.string().min(1, "El nombre es requerido."),
    email: z.string().email("Debe ser un email válido."),
    role: z.enum(['Administrador', 'Cajero'], { required_error: 'El rol es requerido.'}),
    branchId: z.string({ required_error: 'La sucursal es requerida.'}),
});

type UserFormValues = z.infer<typeof userSchema>;

interface UserModalProps {
    user: User | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (user: User) => void;
}

const roles: Role[] = ['Administrador', 'Cajero'];

export function UserModal({ user, isOpen, onOpenChange, onSave }: UserModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState<any[]>([]);
    const authState = useAuth();
    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            name: '',
            email: '',
        }
    });

    useEffect(() => {
        if (isOpen && user) {
            form.reset({
                name: user.name,
                email: user.email,
                role: user.role,
                branchId: user.branchId,
            });
        } else if (isOpen && !user) {
            form.reset({
                name: '',
                email: '',
            });
        }
    }, [isOpen, user, form]);

    useEffect(() => {
    const accountId = authState.userDoc?.accountId as string | undefined;
    const unsub = getBranches(setBranches, accountId);
        return () => unsub();
    }, []);

    const onSubmit = async (data: UserFormValues) => {
        setLoading(true);
        const roleMap: Record<string, string> = { 'Administrador': 'admin', 'Cajero': 'cashier' };
        const userToSave = {
            id: user?.id,
            name: data.name,
            email: data.email,
            role: roleMap[data.role] || 'cashier',
            branchId: data.branchId,
        } as any;
        // If editing existing user, use client-side saveUser (updates)
        if (user && user.id) {
            await saveUser(userToSave);
            toast({ title: `Usuario actualizado`, description: `El usuario "${data.name}" ha sido guardado.` });
            setLoading(false);
            onOpenChange(false);
            return;
        }

        // Creating a new user: call server function to create user for account so clients cannot write users/{uid}
        try {
            const accountId = authState.userDoc?.accountId;
            if (!accountId) throw new Error('No accountId available for current user');

            // get id token for authorization header
            const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
            if (!idToken) throw new Error('No authenticated user token available');

            // prefer NEXT_PUBLIC_CREATE_USER_FN_URL (available in browser). Do not rely on server-only envs here.
            const createUrl = (process.env.NEXT_PUBLIC_CREATE_USER_FN_URL as string) || (window && (window as any).NEXT_PUBLIC_CREATE_USER_FN_URL) || '';
            if (!createUrl) {
                const msg = 'Create user function URL not configured. Set NEXT_PUBLIC_CREATE_USER_FN_URL in .env.local and restart dev server.';
                console.error(msg);
                throw new Error(msg);
            }

            const payload = { accountId, email: data.email, password: '', role: userToSave.role };
            // debug: log the destination and payload so developer can inspect network/console
            console.debug('createUser payload ->', { createUrl, payload });
            const r = await fetch(createUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify(payload),
            });

            if (!r.ok) {
                const text = await r.text();
                throw new Error(text || `Server returned ${r.status}`);
            }

            const json = await r.json();
            if (json.emailed) {
                toast({ title: 'Invitación enviada', description: `Se ha enviado un email a ${data.email} con instrucciones para definir la contraseña.` });
            } else if (json.resetLink) {
                // Show small toast with reset link and copy to clipboard
                try { await navigator.clipboard.writeText(json.resetLink); } catch {}
                toast({ title: 'Enlace de restablecimiento', description: 'Se generó un link de restablecimiento y se copió al portapapeles.' });
            } else {
                toast({ title: 'Usuario creado', description: `Usuario ${data.email} creado (uid: ${json.uid || 'unknown'})` });
            }
        } catch (err: any) {
            console.error('create user error', err);
            toast({ title: 'Error', description: err?.message || String(err) });
        }
    setLoading(false);
    onOpenChange(false);
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            form.reset();
        }
        onOpenChange(open);
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>{user ? 'Editar Usuario' : 'Agregar Nuevo Usuario'}</DialogTitle>
                    <DialogDescription>
                        {user ? 'Edita los detalles del usuario.' : 'Completa el formulario para añadir un nuevo miembro al equipo.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input placeholder="Ej: Juan Pérez" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                         <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="Ej: juan.perez@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="role" render={({ field }) => (
                                <FormItem><FormLabel>Rol</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {roles.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="branchId" render={({ field }) => (
                                <FormItem><FormLabel>Sucursal</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una sucursal" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {branches.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage /></FormItem>
                            )}/>
                        </div>
                        
                        <DialogFooter className="mt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Usuario
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}