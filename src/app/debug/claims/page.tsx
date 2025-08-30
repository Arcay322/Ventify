"use client";

import React, { useEffect, useState } from 'react';
import { auth } from '../../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function ClaimsPage() {
  const [claims, setClaims] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;
      if (!user) {
        setError('No hay ningún usuario autenticado. Inicia sesión primero.');
        setLoading(false);
        setClaims(null);
        return;
      }

      setError(null);
      setLoading(true);
      try {
        // Fuerza refresh para asegurarnos de obtener los custom claims más recientes
        const idTokenResult = await user.getIdTokenResult(true);
        if (!mounted) return;
        setClaims(idTokenResult.claims || {});
      } catch (e: any) {
        if (!mounted) return;
        setError(e && e.message ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      try { unsub(); } catch (e) { /* ignore */ }
    };
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Debug: Claims del usuario</h1>
      {loading && <p>Cargando...</p>}
      {error && (
        <div style={{ color: 'crimson' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      {!loading && !error && (
        <pre style={{ background: '#f6f8fa', padding: 12, borderRadius: 6 }}>
          {JSON.stringify(claims, null, 2)}
        </pre>
      )}
      <p>
        Nota: si recientemente cambiaste claims, cierra sesión y vuelve a iniciar sesión o usa el enlace
        de restablecimiento para forzar la actualización.
      </p>
    </div>
  );
}
