'use client';
import { clienteAuth } from './firebase-client';
import { rutaApi } from './vista-previa-cliente';

export class ErrorCliente extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    public readonly datos: Record<string, unknown> = {},
  ) {
    super(codigo);
  }
}

/** Llama a la API con el ID token de Firebase. Lanza ErrorCliente si `ok` es falso. */
export async function llamar<T = Record<string, unknown>>(
  ruta: string,
  opciones: { metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; cuerpo?: unknown } = {},
): Promise<T> {
  const usuario = clienteAuth().currentUser;
  const token = usuario ? await usuario.getIdToken() : null;
  let res: Response;
  try {
    res = await fetch(rutaApi(ruta), {
      method: opciones.metodo ?? 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opciones.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ErrorCliente(0, 'sin_conexion');
  }
  const datos = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || datos.ok !== true) {
    throw new ErrorCliente(res.status, typeof datos.error === 'string' ? datos.error : 'error_interno', datos);
  }
  return datos as T;
}
