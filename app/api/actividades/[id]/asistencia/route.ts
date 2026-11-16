import { z } from 'zod';
import { rutaParticipante } from '@/lib/api-participante';
import { asistencia } from '@/lib/servicios/participante';

const Cuerpo = z.object({ codigo: z.string().min(1).max(60) });

export const POST = rutaParticipante<z.infer<typeof Cuerpo>, undefined, { id: string }>(
  { cuerpo: Cuerpo },
  async (ctx, { cuerpo, params }) => asistencia(ctx, params.id, cuerpo.codigo),
);
