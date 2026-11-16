/**
 * Diagnóstico del despliegue (temporal): revisa las variables del servidor, la
 * clave privada y una lectura de Firestore. Nunca muestra valores secretos:
 * solo si existen, su forma y el error exacto si algo falla.
 * Abrir en el navegador: /api/diagnostico
 */
import { createPrivateKey } from 'node:crypto';
import { clavePrivada, db, usaEmulador } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const error = (e: unknown) => {
  const x = e as { code?: unknown; message?: unknown; name?: unknown };
  return {
    nombre: typeof x?.name === 'string' ? x.name : null,
    codigo: x?.code ?? null,
    mensaje: typeof x?.message === 'string' ? x.message.slice(0, 400) : String(e).slice(0, 400),
  };
};

export async function GET() {
  const env = process.env;
  const crudo = env.FIREBASE_PRIVATE_KEY ?? '';
  const correo = env.FIREBASE_CLIENT_EMAIL ?? '';

  let claveValida: unknown;
  try {
    createPrivateKey(clavePrivada(crudo));
    claveValida = true;
  } catch (e) {
    claveValida = error(e);
  }

  const inicio = Date.now();
  let firestore: unknown;
  try {
    const s = await db().collection('diagnostico').doc('prueba').get();
    firestore = { ok: true, existe: s.exists, ms: Date.now() - inicio };
  } catch (e) {
    firestore = { ok: false, ms: Date.now() - inicio, ...error(e) };
    console.error('[diagnostico] Firestore', e);
  }

  return Response.json(
    {
      entorno: {
        node: process.version,
        region: env.AWS_REGION ?? env.VERCEL_REGION ?? null,
        netlify: Boolean(env.NETLIFY || env.SITE_ID),
        vercel: Boolean(env.VERCEL),
        emulador: usaEmulador(),
      },
      variables: {
        FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID ?? null,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
        FIREBASE_CLIENT_EMAIL: correo ? `…@${correo.split('@')[1] ?? '(sin @)'}` : null,
        NEXT_PUBLIC_URL_SITIO: env.NEXT_PUBLIC_URL_SITIO ?? null,
      },
      clave: {
        presente: crudo.length > 0,
        longitud: crudo.length,
        empiezaConComilla: /^\s*["']/.test(crudo),
        tieneBegin: crudo.includes('-----BEGIN PRIVATE KEY-----'),
        tieneEnd: crudo.includes('-----END PRIVATE KEY-----'),
        saltosReales: (crudo.match(/\n/g) ?? []).length,
        saltosEscritos: (crudo.match(/\\n/g) ?? []).length,
        valida: claveValida,
      },
      firestore,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
