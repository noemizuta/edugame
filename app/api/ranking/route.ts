import { rutaParticipante } from '@/lib/api-participante';
import { ranking } from '@/lib/servicios/participante';

/** Solo experimental: equipos del aula por XP promedio. Nunca hay ranking individual. */
export const GET = rutaParticipante({}, async (ctx) => ranking(ctx));
