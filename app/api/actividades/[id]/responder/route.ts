import { z } from 'zod';
import { rutaParticipante } from '@/lib/api-participante';
import { responder } from '@/lib/servicios/participante';

const Cuerpo = z.object({
  pregunta: z.string().max(40).optional(),
  opcion: z.number().int().min(0).max(20),
  modo: z.enum(['normal', 'practica']).optional(),
});

export const POST = rutaParticipante<z.infer<typeof Cuerpo>, undefined, { id: string }>(
  { cuerpo: Cuerpo },
  async (ctx, { cuerpo, params }) => responder(ctx, params.id, cuerpo),
);
