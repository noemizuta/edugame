/**
 * CSV para Excel (sección 13): UTF-8 con BOM, separador coma, CRLF.
 * Lógica pura.
 */

export type Celda = string | number | boolean | null | undefined;

/** Evita la inyección de fórmulas en Excel (celdas que empiezan con = + - @). */
function protegerFormula(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function celda(v: Celda): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  const s = protegerFormula(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function aCsv(encabezados: readonly string[], filas: readonly (readonly Celda[])[]): string {
  const lineas = [encabezados.join(','), ...filas.map((f) => f.map(celda).join(','))];
  return `﻿${lineas.join('\r\n')}\r\n`;
}

export const COLUMNAS_EVENTOS = [
  'ts_utc',
  'fecha_lima',
  'codigo',
  'aula',
  'facultad',
  'brazo',
  'equipo',
  'rol',
  'dia',
  'tipo',
  'modulo',
  'actividadId',
  'pregunta',
  'opcion',
  'correcta',
  'puntaje',
  'max',
  'xp',
  'detalle',
] as const;

export const COLUMNAS_PARTICIPANTES = [
  'codigo',
  'aula',
  'facultad',
  'brazo',
  'equipo',
  'xp',
  'nivel',
  'actividades_completadas',
  'retos_completados',
  'racha_actual',
  'dias_activos',
  'mision1_puntaje',
  'ultimo_acceso',
  'consentimiento_fecha',
  'retirado',
] as const;
