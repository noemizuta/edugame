'use client';
/** Código de aula pendiente (del QR del afiche) mientras el estudiante ingresa con Google. */
const CLAVE = 'edugame.codigoAulaPendiente';

export function guardarCodigoPendiente(codigo: string) {
  try {
    localStorage.setItem(CLAVE, codigo);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function leerCodigoPendiente(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function borrarCodigoPendiente() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* almacenamiento no disponible */
  }
}
