"use client"

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
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
// mock-data removed; branches loaded from Firestore via getBranches
import { getBranches } from '@/services/branch-service';
import type { Branch } from '@/types/branch';
import { ProtectedAdmin } from '@/hooks/use-auth';
import { getUsers, saveUser, deleteUser } from '@/services/user-service';
import { auth } from '@/lib/firebase';


export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [accountCounts, setAccountCounts] = useState<{ admins?: number; workers?: number } | null>(null);
  const [accountLimits, setAccountLimits] = useState<{ admins?: number; workers?: number } | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const authState = useAuth();

  useEffect(() => {
  const accountIdParam = authState.userDoc?.accountId as string | undefined;
  if (!accountIdParam) return;
  const unsub = getUsers(setUsers, accountIdParam);
  return () => unsub();
  }, [authState.userDoc]);

  // Debug: check whether a users/{uid} doc exists for the signed-in user
  useEffect(() => {
    const uid = authState.user?.uid;
    if (!uid) return;
    const ref = doc(db as any, 'users', uid);
    getDoc(ref).then((snap) => {
      console.debug('debug: users/{uid} doc for current user', { uid, exists: snap.exists(), data: snap.exists() ? snap.data() : null });
    }).catch((e) => {
      console.error('debug: failed to read users/{uid} doc', e);
    });
  }, [authState.user?.uid]);

  // subscribe to account document to show used/available seats
  useEffect(() => {
    const accountId = authState.userDoc?.accountId;
    if (!accountId) return;
  const ref = doc(db as any, 'accounts', accountId as string);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return setAccountCounts(null);
      const data = snap.data() as any;
      setAccountCounts(data.counts || { admins: 0, workers: 0 });
      setAccountLimits(data.limits || { admins: 1, workers: 4 });
    });
    return () => unsub();
  }, [authState.userDoc]);

  // subscribe to branches for the account so we can display branch names for users
  useEffect(() => {
    const accountId = authState.userDoc?.accountId as string | undefined;
    if (!accountId) return;
    const unsub = getBranches(setBranches, accountId);
    return () => { try { unsub(); } catch (e) {} };
  }, [authState.userDoc]);

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
    try {
      // call server endpoint to safely delete user and decrement account counts
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      if (!idToken) throw new Error('Not authenticated');
      const createUrl = (process.env.NEXT_PUBLIC_CREATE_USER_FN_URL as string) || (window && (window as any).NEXT_PUBLIC_CREATE_USER_FN_URL) || '';
      if (!createUrl) throw new Error('Create user function URL not configured');
      const deleteUrl = createUrl.replace(/createUserForAccount$/, 'deleteUserForAccount');
      const r = await fetch(deleteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ uid: userId }),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || `Server returned ${r.status}`);
      }
    } catch (e) {
      console.error('delete user error', e);
      // fallback: delete locally if server fails
      try { await deleteUser(userId); } catch (e) { console.error('fallback delete failed', e); }
    }
  }
  
  const getBranchName = (branchId?: string) => {
      if (!branchId) return 'N/A';
      return branches.find(b => b.id === branchId)?.name || 'N/A';
  }

  return (
    <ProtectedAdmin fallback={<div className="p-6">Acceso denegado</div>}>
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h1>
        <div className="flex items-center gap-4">
          {accountCounts && accountLimits && (
            <div className="text-sm text-muted-foreground">
              <span className="mr-2">Asientos:</span>
              <Badge variant="secondary">{(accountCounts.workers||0) + (accountCounts.admins||0)} / {(accountLimits.workers||0) + (accountLimits.admins||0)}</Badge>
            </div>
          )}
          <Button style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }} onClick={() => handleOpenModal(null)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Usuario
          </Button>
        </div>
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
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge>
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