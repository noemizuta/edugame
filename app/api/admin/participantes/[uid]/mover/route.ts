import { z } from 'zod';
import { ruta } from '@/lib/api';
import { moverParticipante } from '@/lib/servicios/admin';

const Cuerpo = z.object({ aulaId: z.string().min(1).max(100) });

/** PA4: mueve a un estudiante de aula (queda el evento aula_movida). */
export const POST = ruta<z.infer<typeof Cuerpo>, undefined, { uid: string }>(
  { roles: ['admin'], cuerpo: Cuerpo },
  async ({ usuario, cuerpo, params, ahora }) => moverParticipante(usuario, params.uid, cuerpo.aulaId, ahora),
);
