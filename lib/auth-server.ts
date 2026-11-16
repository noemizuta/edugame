/**
 * Verificación del ID token de Firebase en cada solicitud. SOLO SERVIDOR.
 */
import 'server-only';
import { adminAuth } from './firebase-admin';
import { ErrorApi } from './errores';

export interface TokenVerificado {
  uid: string;
  email: string;
  nombre: string | null;
}

/** Lee `Authorization: Bearer <ID token>`, lo verifica y exige una cuenta de Google con correo. */
export async function verificarToken(req: Request): Promise<TokenVerificado> {
  const cabecera = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(cabecera);
  if (!m) throw new ErrorApi(401, 'no_autenticado');

  let decodificado;
  try {
    decodificado = await adminAuth().verifyIdToken(m[1]!);
  } catch {
    throw new ErrorApi(401, 'token_invalido');
  }
  if (decodificado.firebase?.sign_in_provider !== 'google.com') throw new ErrorApi(403, 'proveedor_no_permitido');
  if (!decodificado.email) throw new ErrorApi(403, 'sin_correo');

  return {
    uid: decodificado.uid,
    email: decodificado.email.toLowerCase(),
    nombre: typeof decodificado.name === 'string' ? decodificado.name : null,
  };
}

/** DOMINIOS_PERMITIDOS (opcional): solo esas cuentas pueden crear una sesión. */
export function dominioPermitido(email: string): boolean {
  const lista = (process.env.DOMINIOS_PERMITIDOS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
  if (lista.length === 0) return true;
  const dominio = email.split('@')[1] ?? '';
  return lista.includes(dominio);
}
