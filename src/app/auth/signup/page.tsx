"use client";
import React from 'react';
import { signup } from '@/services/auth-service';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function SignupPage() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [role, setRole] = React.useState<'owner'|'admin'|'cashier'>('cashier');
  const router = useRouter();
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signup(email, password, displayName, role);
      toast({ title: 'Cuenta creada' });
      router.push('/auth/login');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo crear la cuenta', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Registro</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full p-2 border" placeholder="Nombre" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        <input className="w-full p-2 border" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="w-full p-2 border" placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <select value={role} onChange={e => setRole(e.target.value as any)} className="w-full p-2 border">
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="cashier">Cashier</option>
        </select>
        <button className="btn btn-primary" type="submit">Crear cuenta</button>
      </form>
    </div>
  );
}
