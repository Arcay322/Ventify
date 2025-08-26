"use client";
import React from 'react';
import { login } from '@/services/auth-service';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const router = useRouter();
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast({ title: 'Sesión iniciada' });
      router.push('/');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo iniciar sesión', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Iniciar sesión</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full p-2 border" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="w-full p-2 border" placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="btn btn-primary" type="submit">Entrar</button>
      </form>
    </div>
  );
}
