import { rutaParticipante } from '@/lib/api-participante';
import { actividadVista } from '@/lib/servicios/participante';

/** Actividad saneada para el brazo, con el estado previo. Nunca incluye respuestas sin responder. */
export const GET = rutaParticipante<undefined, undefined, { id: string }>({}, async (ctx, { params }) => ({
  actividad: await actividadVista(ctx, params.id),
}));
