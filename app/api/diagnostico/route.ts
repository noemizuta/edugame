/**
 * Diagnóstico del despliegue (temporal). Carga cada pieza por separado (con
 * import dinámico, para atrapar también los errores al cargar módulos) y dice
 * cuál falla y por qué. Nunca muestra valores secretos.
 * Abrir en el navegador: /api/diagnostico
 */
export const dynamic = 'force-dynamic';

const error = (e: unknown) => {
  const x = e as { code?: unknown; message?: unknown; name?: unknown; stack?: unknown };
  return {
    ok: false,
    nombre: typeof x?.name === 'string' ? x.name : null,
    codigo: x?.code ?? null,
    mensaje: typeof x?.message === 'string' ? x.message.slice(0, 600) : String(e).slice(0, 600),
    pila: typeof x?.stack === 'string' ? x.stack.split('\n').slice(1, 6).map((l) => l.trim()) : null,
  };
};

async function paso<T>(fn: () => Promise<T>): Promise<T | ReturnType<typeof error>> {
  try {
    return await fn();
  } catch (e) {
    console.error('[diagnostico]', e);
    return error(e);
  }
}

export async function GET() {
  const env = process.env;
  const crudo = env.FIREBASE_PRIVATE_KEY ?? '';
  const correo = env.FIREBASE_CLIENT_EMAIL ?? '';
  const r: Record<string, unknown> = {
    entorno: {
      node: process.version,
      region: env.AWS_REGION ?? env.VERCEL_REGION ?? null,
      netlify: Boolean(env.NETLIFY || env.SITE_ID),
      vercel: Boolean(env.VERCEL),
      USE_FIREBASE_EMULATOR: env.USE_FIREBASE_EMULATOR ?? null,
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
    },
  };

  r.paso1_firebaseAdminApp = await paso(async () => {
    await import('firebase-admin/app');
    return { ok: true };
  });
  r.paso2_firebaseAdminFirestore = await paso(async () => {
    await import('firebase-admin/firestore');
    return { ok: true };
  });
  r.paso3_firebaseAdminAuth = await paso(async () => {
    await import('firebase-admin/auth');
    return { ok: true };
  });
  r.paso4_libFirebaseAdmin = await paso(async () => {
    const m = await import('@/lib/firebase-admin');
    const { createPrivateKey } = await import('node:crypto');
    createPrivateKey(m.clavePrivada(crudo));
    return { ok: true, claveValida: true };
  });
  r.paso5_lecturaFirestore = await paso(async () => {
    const m = await import('@/lib/firebase-admin');
    const inicio = Date.now();
    const s = await m.db().collection('diagnostico').doc('prueba').get();
    return { ok: true, existe: s.exists, ms: Date.now() - inicio };
  });

  return Response.json(r, { headers: { 'Cache-Control': 'no-store' } });
}
