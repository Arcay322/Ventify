"use client";
import React from 'react';
import { signup } from '@/services/auth-service';
// use browser fetch
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function SignupPage() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [businessName, setBusinessName] = React.useState('');
  // Users self-register as 'cashier' by default. Admin/owner creation is handled server-side.
  const role: 'cashier' = 'cashier';
  const router = useRouter();
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // If serverless public signup function is configured, call it to create account + owner
      const FN_URL = process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_URL || process.env.NEXT_PUBLIC_CREATE_USER_FN_URL;
      if (!FN_URL) {
        throw new Error('Public signup endpoint not configured. Set NEXT_PUBLIC_PUBLIC_SIGNUP_URL');
      }
      const body = { businessName: businessName || displayName || 'My Business', ownerName: displayName || '', email, password };
      const r = await fetch(FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) {
        const err = await r.text();
        throw new Error('Server signup failed: ' + err);
      }
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
  {/* Self-registration always creates a cashier. Role selection reserved for admins. */}
        <button className="btn btn-primary" type="submit">Crear cuenta</button>
      </form>
    </div>
  );
}
