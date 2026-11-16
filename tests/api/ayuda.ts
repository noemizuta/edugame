/**
 * Utilidades para probar la API contra los emuladores de Firebase con tokens
 * reales del emulador de Auth (proveedor google.com simulado).
 * Se ejecuta con `npm run test:api` (firebase emulators:exec).
 */
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '@/lib/firebase-admin';
import { EQUIPOS, type Equipo } from '@/lib/juego';
import { type AulaDoc, COL } from '@/lib/modelo';

process.env.USE_FIREBASE_EMULATOR = 'true';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
export const PROYECTO = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'edugame-ram';
process.env.FIREBASE_PROJECT_ID = PROYECTO;

const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
const FS = `http://${process.env.FIRESTORE_EMULATOR_HOST}`;

export async function limpiar() {
  const r1 = await fetch(`${FS}/emulator/v1/projects/${PROYECTO}/databases/(default)/documents`, { method: 'DELETE' });
  const r2 = await fetch(`${AUTH}/emulator/v1/projects/${PROYECTO}/accounts`, { method: 'DELETE' });
  if (!r1.ok || !r2.ok) throw new Error('No se pudieron limpiar los emuladores');
}

let contador = 0;

/** ID token de una cuenta de Google simulada (el emulador acepta un id_token sin firmar). */
export async function tokenGoogle(email: string, nombre = 'Persona de prueba'): Promise<string> {
  const sub = `sub-${email}`;
  const idToken = JSON.stringify({ sub, email, email_verified: true, name: nombre });
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=clave-falsa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postBody: `id_token=${encodeURIComponent(idToken)}&providerId=google.com`,
      requestUri: 'http://localhost',
      returnIdpCredential: true,
      returnSecureToken: true,
    }),
  });
  const datos = (await r.json()) as { idToken?: string; error?: unknown };
  if (!datos.idToken) throw new Error(`signInWithIdp falló: ${JSON.stringify(datos)}`);
  return datos.idToken;
}

/** ID token de una cuenta con correo y contraseña (para probar que se rechaza). */
export async function tokenContrasena(email: string): Promise<string> {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=clave-falsa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'clave-de-prueba-123', returnSecureToken: true }),
  });
  return ((await r.json()) as { idToken: string }).idToken;
}

export const correo = (nombre = 'persona') => `${nombre}-${++contador}@example.com`;

type Manejador = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;

/** Llama a un Route Handler como lo haría Next. */
export async function llamar(
  manejador: (req: Request, ctx: { params: Promise<any> }) => Promise<Response>,
  opciones: { token?: string; metodo?: string; cuerpo?: unknown; url?: string; params?: Record<string, string> } = {},
): Promise<{ status: number; datos: any }> {
  const req = new Request(opciones.url ?? 'http://localhost/api/prueba', {
    method: opciones.metodo ?? 'POST',
    headers: {
      ...(opciones.token ? { Authorization: `Bearer ${opciones.token}` } : {}),
      ...(opciones.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
  });
  const res = await (manejador as Manejador)(req, { params: Promise.resolve(opciones.params ?? {}) as Promise<never> });
  return { status: res.status, datos: await res.json() };
}

/** Crea un aula con su código de unión directamente en Firestore. */
export async function crearAula(
  id: string,
  datos: Partial<AulaDoc> & Pick<AulaDoc, 'brazo' | 'codigoUnion'>,
): Promise<void> {
  const aula: AulaDoc = {
    nombre: `Aula ${id}`,
    facultad: 'Ciencias de la Salud',
    fechaInicio: fechaInicioDia(1),
    capacidad: 30,
    inscritos: 0,
    equipos: Object.fromEntries(EQUIPOS.map((e) => [e, 0])) as Record<Equipo, number>,
    activa: true,
    prueba: true,
    enlaceGrupo: null,
    creadoPor: 'prueba',
    creado: Timestamp.now(),
    ...datos,
  };
  await db().collection(COL.aulas).doc(id).set(aula);
  await db().collection(COL.codigosUnion).doc(datos.codigoUnion).set({ aulaId: id });
}

/** Lee todos los documentos de todas las colecciones (también subcolecciones conocidas). */
export async function volcado(): Promise<{ ruta: string; datos: Record<string, unknown> }[]> {
  const f = db();
  const salida: { ruta: string; datos: Record<string, unknown> }[] = [];
  for (const c of await f.listCollections()) {
    for (const d of (await f.collectionGroup(c.id).get()).docs) salida.push({ ruta: d.ref.path, datos: d.data() });
  }
  return salida;
}

/** Fecha de inicio para que hoy (en Lima) el aula esté en el día `n` del estudio (decisión 7). */
export function fechaInicioDia(n: number): string {
  const hoy = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
  return new Date(new Date(`${hoy}T00:00:00Z`).getTime() - (n - 1) * 86_400_000).toISOString().slice(0, 10);
}
