'use client';
/**
 * Firebase en el navegador: SOLO Authentication (Google).
 * No se importa Firestore en el cliente.
 */
import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, connectAuthEmulator, getAuth } from 'firebase/auth';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let auth: Auth | null = null;

export function clienteAuth(): Auth {
  if (auth) return auth;
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(config);
  auth = getAuth(app);
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
    // Mismo host que la página (localhost o 127.0.0.1): así el iframe del emulador no queda
    // como «de terceros» y el ingreso por redirección funciona.
    const host = window.location.hostname === 'localhost' ? 'localhost' : '127.0.0.1';
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  }
  return auth;
}
