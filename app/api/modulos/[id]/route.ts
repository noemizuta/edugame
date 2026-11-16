import { rutaParticipante } from '@/lib/api-participante';
import { moduloVista } from '@/lib/servicios/participante';

export const GET = rutaParticipante<undefined, undefined, { id: string }>({}, async (ctx, { params }) =>
  moduloVista(ctx, params.id),
);
