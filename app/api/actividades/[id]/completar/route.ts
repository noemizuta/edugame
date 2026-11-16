import { rutaParticipante } from '@/lib/api-participante';
import { completar } from '@/lib/servicios/participante';

/** lectura, audio y evaluacion (y, en el control, el caso comentado y la lectura del reto). */
export const POST = rutaParticipante<undefined, undefined, { id: string }>({}, async (ctx, { params }) =>
  completar(ctx, params.id),
);
