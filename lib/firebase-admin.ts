/**
 * firebase-admin: Firestore y verificación de tokens. SOLO SERVIDOR.
 * El navegador nunca accede a Firestore (reglas deny-all).
 */
import 'server-only';
import { type App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { type Auth, getAuth } from 'firebase-admin/auth';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';

export const usaEmulador = (): boolean => process.env.USE_FIREBASE_EMULATOR === 'true';

function iniciar(): App {
  const existente = getApps()[0];
  if (existente) return existente;

  if (usaEmulador()) {
    if (process.env.VERCEL_ENV === 'production') {
      throw new Error('USE_FIREBASE_EMULATOR=true no está permitido en producción');
    }
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-edugame';
    // Sin credenciales en los emuladores: evita que se busque el servidor de metadatos de Google Cloud.
    process.env.METADATA_SERVER_DETECTION ??= 'none';
    return initializeApp({ projectId });
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error('Faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY');
  }
  return initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    projectId: FIREBASE_PROJECT_ID,
  });
}

// La instancia vive en globalThis: Next puede cargar este módulo más de una vez (una copia por ruta
// o tras recompilar en desarrollo), pero firebase-admin comparte una sola Firestore y `settings()`
// solo se puede llamar una vez.
const global = globalThis as typeof globalThis & { __edugameFirestore?: Firestore };

export function db(): Firestore {
  if (!global.__edugameFirestore) {
    const f = getFirestore(iniciar());
    try {
      f.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Otra copia del módulo ya la configuró (con los mismos ajustes).
    }
    global.__edugameFirestore = f;
  }
  return global.__edugameFirestore;
}

export const adminAuth = (): Auth => getAuth(iniciar());
