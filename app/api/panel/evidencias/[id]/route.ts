import { z } from 'zod';
import { ruta } from '@/lib/api';
import { revisarEvidencia } from '@/lib/servicios/panel';

const Cuerpo = z.object({ accion: z.enum(['aprobar', 'devolver']), comentario: z.string().max(800).optional() });

/** Aprobar (otorga el XP de la misión) o devolver (con comentario obligatorio). */
export const POST = ruta<z.infer<typeof Cuerpo>, undefined, { id: string }>(
  { roles: ['promotor', 'admin'], cuerpo: Cuerpo },
  async ({ usuario, cuerpo, params, ahora }) => revisarEvidencia(usuario, params.id, cuerpo.accion, cuerpo.comentario, ahora),
);
