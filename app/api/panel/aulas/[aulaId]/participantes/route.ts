import { ruta } from '@/lib/api';
import { participantesAula } from '@/lib/servicios/panel';

/** Código, equipo, XP, días activos, último acceso y semáforo. */
export const GET = ruta<undefined, undefined, { aulaId: string }>(
  { roles: ['promotor', 'admin', 'investigador'] },
  async ({ usuario, params, ahora }) => participantesAula(usuario, params.aulaId, ahora),
);
