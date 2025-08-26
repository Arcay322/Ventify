// Script: create-and-login-user.js
// Intenta crear un usuario con Email/Password y luego iniciar sesión.
require('dotenv').config({ path: './.env.local' });
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
};

const app = initializeApp(config);
const auth = getAuth(app);

const email = process.env.TEST_USER_EMAIL || `test+${Date.now()}@example.com`;
const password = process.env.TEST_USER_PASSWORD || 'Test1234!';

(async () => {
  try {
    console.log('Intentando crear usuario:', email);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    console.log('Usuario creado con uid:', cred.user.uid);
  } catch (e) {
    if (e && e.code === 'auth/email-already-in-use') {
      console.log('El email ya existe, intentar iniciar sesión...');
    } else {
      console.error('Error al crear usuario:', e && e.message ? e.message : e);
      // continuar e intentar login en caso de que sea otro error
    }
  }

  try {
    console.log('Intentando iniciar sesión con:', email);
    const s = await signInWithEmailAndPassword(auth, email, password);
    console.log('Login exitoso. uid:', s.user.uid, 'email:', s.user.email);
    process.exit(0);
  } catch (e) {
    console.error('Fallo al iniciar sesión:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
