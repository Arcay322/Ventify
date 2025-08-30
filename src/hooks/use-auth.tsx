"use client";
import React from 'react';
import { onAuthChange } from '@/services/auth-service';
import { auth } from '@/lib/firebase';
import { subscribeUserDoc } from '@/services/auth-service';

type UserDoc = { id?: string; role?: 'owner' | 'admin' | 'manager' | 'cashier' | 'user'; branchId?: string; accountId?: string; [key: string]: unknown } | null;
type AuthState = { initialized?: boolean; uid?: string | null; user?: { uid?: string; email?: string; displayName?: string } | null; userDoc?: UserDoc };

const AuthContext = React.createContext<{ state: AuthState }>({ state: {} });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = React.useState<AuthState>({ initialized: false });

    React.useEffect(() => {
    let cleanupUserDoc: (() => void) | null = null;
    const unsub = onAuthChange(async (u) => {
      if (u) {
        // Force token refresh to ensure users have latest claims
        try {
          await u.getIdTokenResult(true);
        } catch (e) {
          console.warn('[AUTH] Could not refresh token:', e);
        }
        
        setState(s => ({ ...s, initialized: true, uid: u.uid, user: { uid: u.uid, email: u.email ?? undefined, displayName: u.displayName ?? undefined } }));
        cleanupUserDoc = subscribeUserDoc(u.uid, (doc) => setState(s => ({ ...s, userDoc: doc })));
      } else {
        // cleanup previous subscription
        if (cleanupUserDoc) { cleanupUserDoc(); cleanupUserDoc = null; }
        setState({ initialized: true });
      }
    });
    return () => {
      if (cleanupUserDoc) cleanupUserDoc();
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
  const role = (userDoc.role as string) || 'cashier';
  if (role === 'owner' || role === 'admin') return <>{children}</>;
  return <>{fallback}</>;
};

// Helper that components can use to check if the user is manager for a given branch
export const isManagerForBranch = (userDoc: UserDoc, branchId?: string) => {
  if (!userDoc) return false;
  return userDoc.role === 'manager' && branchId && userDoc.branchId === branchId;
};

export default useAuth;
