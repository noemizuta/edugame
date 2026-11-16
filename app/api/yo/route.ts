import { rutaParticipante } from '@/lib/api-participante';
import { yo } from '@/lib/servicios/participante';

/** Perfil, aula, día del estudio, fase, siguiente misión o tema, módulos y (solo experimental) juego. */
export const GET = rutaParticipante({}, async (ctx) => yo(ctx));
