import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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

// Validación de configuración mínima
const requiredKeys = [
  { key: 'apiKey', env: 'NEXT_PUBLIC_FIREBASE_API_KEY or FIREBASE_API_KEY' },
  { key: 'projectId', env: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID or FIREBASE_PROJECT_ID' },
  { key: 'appId', env: 'NEXT_PUBLIC_FIREBASE_APP_ID or FIREBASE_APP_ID' },
];

const missing = requiredKeys.filter(r => !firebaseConfig[r.key as keyof typeof firebaseConfig]);
if (missing.length) {
  const missingList = missing.map(m => m.env).join(', ');
  throw new Error(
    `Firebase no está configurado correctamente. Faltan variables: ${missingList}. ` +
    `Rellena .env.local basado en .env.example y reinicia el servidor.`
  );
}

// Inicializar Firebase (ya que la validación pasó)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
// Debug: log projectId at client runtime so we can confirm which Firebase project the browser is using.
// This will print in the browser console during development (NEXT_PUBLIC vars must be set).
try {
  // eslint-disable-next-line no-console
  if (typeof window !== 'undefined') console.debug('debug: firebase projectId (client):', firebaseConfig.projectId);
} catch (e) {
  // ignore
}
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
