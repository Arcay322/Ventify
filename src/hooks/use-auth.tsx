"use client";
import React from 'react';
import { onAuthChange } from '@/services/auth-service';
import { auth } from '@/lib/firebase';
import { subscribeUserDoc } from '@/services/auth-service';

type AuthState = { uid?: string | null; user?: any | null; userDoc?: any | null };

const AuthContext = React.createContext<{ state: AuthState }>({ state: {} });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = React.useState<AuthState>({});

  React.useEffect(() => {
    const unsub = onAuthChange((u) => {
      if (u) {
        setState(s => ({ ...s, uid: u.uid, user: { uid: u.uid, email: u.email, displayName: u.displayName } }));
        const unsubDoc = subscribeUserDoc(u.uid, (doc) => setState(s => ({ ...s, userDoc: doc })));
        // keep user doc subscription until sign out
        (unsub as any).cleanup = unsubDoc;
      } else {
        setState({});
      }
    });
    return () => {
      if ((unsub as any).cleanup) (unsub as any).cleanup();
      unsub();
    };
  }, []);

  return <AuthContext.Provider value={{ state }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => React.useContext(AuthContext).state;

// ProtectedAdmin component to guard render for admin/owner roles
export const ProtectedAdmin = ({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) => {
  const { userDoc } = useAuth();
  if (!userDoc) return <>{fallback}</>;
  const role = userDoc.role || 'cashier';
  if (role === 'owner' || role === 'admin') return <>{children}</>;
  return <>{fallback}</>;
};

export default useAuth;
