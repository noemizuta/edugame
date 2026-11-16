/**
 * Envoltura `ruta()` para todos los Route Handlers (DECISIONES · Arquitectura):
 * verifica el token, valida la entrada con zod, comprueba el rol, el retiro,
 * el consentimiento y el aula (409 con el siguiente paso), y traduce los
 * errores a `{ ok: false, error }`. SOLO SERVIDOR.
 */
import 'server-only';
import { z } from 'zod';
import { type TokenVerificado, verificarToken } from './auth-server';
import { ErrorApi } from './errores';
import { db } from './firebase-admin';
import { type Rol, siguientePaso } from './juego';
import { COL, type UsuarioDoc } from './modelo';

export { ErrorApi };

export type Usuario = UsuarioDoc & { uid: string };

interface Opciones<C, Q> {
  /** Roles que pueden usar la ruta. Por defecto, cualquiera con sesión. */
  roles?: readonly Rol[];
  /** Requisitos del estudiante: si faltan, 409 con el siguiente paso. */
  requiere?: 'consentimiento' | 'aula';
  cuerpo?: z.ZodType<C>;
  consulta?: z.ZodType<Q>;
}

export interface Contexto<C, Q, P> {
  req: Request;
  token: TokenVerificado;
  usuario: Usuario;
  cuerpo: C;
  consulta: Q;
  params: P;
  ahora: Date;
}

type Resultado = Record<string, unknown> | Response;
type Manejador<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;

export const json = (status: number, datos: Record<string, unknown>) =>
  Response.json(datos, { status, headers: { 'Cache-Control': 'no-store' } });

export const ok = (datos: Record<string, unknown> = {}) => json(200, { ok: true, ...datos });

function aRespuesta(e: unknown): Response {
  if (e instanceof ErrorApi) return json(e.status, { ok: false, error: e.codigo, ...e.extra });
  if (e instanceof z.ZodError) {
    return json(400, { ok: false, error: 'entrada_invalida', campos: e.issues.map((i) => i.path.join('.')) });
  }
  console.error('[api] error inesperado', e);
  return json(500, { ok: false, error: 'error_interno' });
}

async function leerCuerpo(req: Request): Promise<unknown> {
  const texto = await req.text();
  if (!texto) return {};
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErrorApi(400, 'json_invalido');
  }
}

async function analizar<C, Q>(req: Request, op: Opciones<C, Q>): Promise<{ cuerpo: C; consulta: Q }> {
  const cuerpo = (op.cuerpo ? op.cuerpo.parse(await leerCuerpo(req)) : undefined) as C;
  const consulta = (
    op.consulta ? op.consulta.parse(Object.fromEntries(new URL(req.url).searchParams)) : undefined
  ) as Q;
  return { cuerpo, consulta };
}

/** Comprueba rol, retiro y requisitos del estudiante. Lanza ErrorApi. */
export function comprobarAcceso(usuario: Usuario, op: { roles?: readonly Rol[]; requiere?: 'consentimiento' | 'aula' }) {
  if (usuario.rol === 'estudiante' && usuario.retirado) throw new ErrorApi(403, 'retirado');
  if (op.roles && !op.roles.includes(usuario.rol)) throw new ErrorApi(403, 'rol_no_permitido');
  if (usuario.rol !== 'estudiante' || !op.requiere) return;
  const falta = !usuario.consentimiento || (op.requiere === 'aula' && !usuario.aulaId);
  if (falta) throw new ErrorApi(409, 'paso_pendiente', { siguientePaso: siguientePaso(usuario) });
}

export async function leerUsuario(uid: string): Promise<Usuario | null> {
  const s = await db().collection(COL.usuarios).doc(uid).get();
  return s.exists ? { uid, ...(s.data() as UsuarioDoc) } : null;
}

/** Ruta autenticada con usuario existente en `usuarios`. */
export function ruta<C = undefined, Q = undefined, P = Record<string, never>>(
  op: Opciones<C, Q>,
  manejar: (ctx: Contexto<C, Q, P>) => Promise<Resultado>,
): Manejador<P> {
  return async (req, ctx) => {
    try {
      const token = await verificarToken(req);
      const usuario = await leerUsuario(token.uid);
      if (!usuario) throw new ErrorApi(401, 'sin_sesion');
      comprobarAcceso(usuario, op);
      const { cuerpo, consulta } = await analizar(req, op);
      const params = (await ctx?.params) ?? ({} as P);
      const r = await manejar({ req, token, usuario, cuerpo, consulta, params, ahora: new Date() });
      return r instanceof Response ? r : ok(r);
    } catch (e) {
      return aRespuesta(e);
    }
  };
}

/** Ruta que solo exige un token válido (p. ej. /api/sesion, que crea el usuario). */
export function rutaToken<C = undefined>(
  op: { cuerpo?: z.ZodType<C> },
  manejar: (ctx: { req: Request; token: TokenVerificado; cuerpo: C; ahora: Date }) => Promise<Resultado>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      const token = await verificarToken(req);
      const { cuerpo } = await analizar<C, undefined>(req, op);
      const r = await manejar({ req, token, cuerpo, ahora: new Date() });
      return r instanceof Response ? r : ok(r);
    } catch (e) {
      return aRespuesta(e);
    }
  };
}
