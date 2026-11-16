import { z } from 'zod';
import { rutaParticipante } from '@/lib/api-participante';
import { registrarEventoCliente } from '@/lib/servicios/participante';

const Cuerpo = z.object({
  tipo: z.enum(['ver_modulo', 'ver_item', 'abrir_enlace', 'abrir_evaluacion']),
  modulo: z.string().max(60).optional(),
  actividadId: z.string().max(60).optional(),
});

/** El servidor completa aula, brazo, equipo y día del estudio. */
export const POST = rutaParticipante<z.infer<typeof Cuerpo>>({ cuerpo: Cuerpo }, async (ctx, { cuerpo }) =>
  registrarEventoCliente(ctx, cuerpo.tipo, cuerpo.modulo, cuerpo.actividadId),
);
