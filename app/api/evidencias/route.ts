import { z } from 'zod';
import { rutaParticipante } from '@/lib/api-participante';
import { enviarEvidencia } from '@/lib/servicios/participante';

const Cuerpo = z.object({
  misionId: z.string().min(1).max(60),
  campos: z.record(z.string().max(60), z.union([z.string().max(2000), z.number()])),
});

export const POST = rutaParticipante<z.infer<typeof Cuerpo>>({ cuerpo: Cuerpo }, async (ctx, { cuerpo }) =>
  enviarEvidencia(ctx, cuerpo.misionId, cuerpo.campos),
);
