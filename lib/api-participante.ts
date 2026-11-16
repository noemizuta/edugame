/** Rutas del participante: estudiante con consentimiento y aula, y su contexto (aula, brazo y día del estudio). */
import 'server-only';
import type { z } from 'zod';
import { ruta } from './api';
import { almacenFirestore } from './servicios/almacen';
import { type Ctx, contexto } from './servicios/participante';

export function rutaParticipante<C = undefined, Q = undefined, P = Record<string, never>>(
  op: { cuerpo?: z.ZodType<C>; consulta?: z.ZodType<Q> },
  manejar: (ctx: Ctx, entrada: { cuerpo: C; consulta: Q; params: P }) => Promise<Record<string, unknown> | object>,
) {
  return ruta<C, Q, P>({ roles: ['estudiante'], requiere: 'aula', ...op }, async ({ usuario, cuerpo, consulta, params, ahora }) => {
    const ctx = await contexto(usuario, almacenFirestore, ahora);
    return (await manejar(ctx, { cuerpo, consulta, params })) as Record<string, unknown>;
  });
}
