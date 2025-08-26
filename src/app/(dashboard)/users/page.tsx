"use client"

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import { UserModal } from '@/components/user-modal';
import type { User, Role } from '@/types/user';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from '@/components/ui/badge';
import { mockBranches } from '@/lib/mock-data';
import { ProtectedAdmin } from '@/hooks/use-auth';
import { getUsers, saveUser, deleteUser } from '@/services/user-service';

const mockUsers: User[] = [
  {
    id: 'user-1',
    name: 'Admin General',
    email: 'admin@ventify.com',
    role: 'Administrador',
    branchId: 'branch-1',
  },
  {
    id: 'user-2',
    name: 'Juan Cajero',
    email: 'juan.cajero@ventify.com',
    role: 'Cajero',
    branchId: 'branch-1',
  },
   {
    id: 'user-3',
    name: 'Maria Cajera',
    email: 'maria.cajera@ventify.com',
    role: 'Cajero',
    branchId: 'branch-2',
  },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = getUsers(setUsers);
    return () => unsub();
  }, []);

  const handleOpenModal = (user: User | null) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  }

  // This function would be implemented with the database service
  const handleSaveUser = async (user: User) => {
    await saveUser(user as any);
    setIsModalOpen(false);
  };

  const handleDeleteUser = async (userId: string) => {
    await deleteUser(userId);
  }
  
  const getBranchName = (branchId: string) => {
      return mockBranches.find(b => b.id === branchId)?.name || 'N/A';
  }

  return (
    <ProtectedAdmin fallback={<div className="p-6">Acceso denegado</div>}>
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h1>
        <Button style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }} onClick={() => handleOpenModal(null)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Agregar Usuario
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
          <CardDescription>Administra el acceso y los permisos de tus empleados.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Sucursal Asignada</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                      <Badge variant={user.role === 'Administrador' ? 'default' : 'secondary'}>{user.role}</Badge>
                  </TableCell>
                  <TableCell>{getBranchName(user.branchId)}</TableCell>
                  <TableCell className="text-right space-x-2">
                     <Button variant="outline" size="icon" onClick={() => handleOpenModal(user)}>
                       <Edit className="h-4 w-4" />
                       <span className="sr-only">Editar Usuario</span>
                     </Button>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Eliminar Usuario</span>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará permanentemente al usuario.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>Continuar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <UserModal 
        user={selectedUser} 
        isOpen={isModalOpen} 
        onOpenChange={setIsModalOpen}
        onSave={handleSaveUser}
      />
    </div>
    </ProtectedAdmin>
  )
}