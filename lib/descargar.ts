'use client';
import { ErrorCliente } from './cliente-api';
import { clienteAuth } from './firebase-client';

/** Descarga un archivo de la API (con el token) y lo guarda con el nombre que indica el servidor. */
export async function descargar(ruta: string, nombrePorDefecto: string) {
  const token = await clienteAuth().currentUser?.getIdToken();
  const res = await fetch(ruta, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
  if (!res.ok) {
    const datos = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ErrorCliente(res.status, datos.error ?? 'error_interno');
  }
  const nombre = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? nombrePorDefecto;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copia un texto; si el navegador no lo permite, lo muestra para copiarlo a mano. */
export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    window.prompt('Copia este texto:', texto);
    return false;
  }
}
