'use client';
/**
 * Modo vista previa en el navegador (PA6). Mientras está activo, `llamar()` usa
 * `/api/vista-previa/…` y los enlaces del participante quedan dentro de
 * `/vista-previa/…`, con el brazo y el día elegidos.
 */
import type { Brazo } from './juego';

export interface ModoVistaPrevia {
  brazo: Brazo;
  dia: number;
}

let modo: ModoVistaPrevia | null = null;

export function activarVistaPrevia(m: ModoVistaPrevia | null) {
  if (typeof window !== 'undefined') modo = m;
}

export const vistaPrevia = (): ModoVistaPrevia | null => modo;

const consulta = (m: ModoVistaPrevia) => `brazo=${m.brazo}&dia=${m.dia}`;

/** Solo la API del participante tiene espejo en la vista previa (no /api/sesion ni los paneles). */
const API_PARTICIPANTE = /^\/api\/(yo|modulos|actividades|ranking|evidencias|eventos|perfil)(\/|\?|$)/;

/** `/api/yo` → `/api/vista-previa/yo?brazo=…&dia=…` en la vista previa. */
export function rutaApi(ruta: string): string {
  if (!modo || !API_PARTICIPANTE.test(ruta)) return ruta;
  const [camino, qs] = ruta.split('?');
  return `${camino!.replace(/^\/api\//, '/api/vista-previa/')}?${qs ? `${qs}&` : ''}${consulta(modo)}`;
}

/** `/modulo/lab` → `/vista-previa/modulo/lab?brazo=…&dia=…` en la vista previa. */
export function rutaPagina(ruta: string): string {
  if (!modo) return ruta;
  return `/vista-previa${ruta}?${consulta(modo)}`;
}

/** Quita el prefijo de la vista previa (para marcar la pestaña activa). */
export const sinPrefijo = (ruta: string) => ruta.replace(/^\/vista-previa/, '');
