import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Configuración a través de variables de entorno.
// Se espera que las variables estén prefijadas con NEXT_PUBLIC_ para su uso en el cliente
// (Firebase API key suele ser pública en clientes, pero no debe comitearse en el repositorio).
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  // Si falta configuración crítica, lanzamos un error en tiempo de ejecución para evitar comportamientos inesperados.
  // En producción, preferible lanzar durante el arranque o revisar variables de entorno en CI.
  // Nota: no incluimos claves reales en el repositorio.
  // eslint-disable-next-line no-console
  console.warn('Firebase no está completamente configurado. Revisa las variables de entorno.');
}

// Inicializar Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
