import { rutaParticipante } from '@/lib/api-participante';
import { misEvidencias } from '@/lib/servicios/participante';

export const GET = rutaParticipante({}, async (ctx) => ({ evidencias: await misEvidencias(ctx) }));
