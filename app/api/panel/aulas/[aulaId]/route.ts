import { z } from 'zod';
import { ruta } from '@/lib/api';
import { guardarEnlaceGrupo } from '@/lib/servicios/panel';

const Cuerpo = z.object({ enlaceGrupo: z.string().max(500).nullable() });

/** Enlace del grupo del aula (Telegram o WhatsApp). */
export const PATCH = ruta<z.infer<typeof Cuerpo>, undefined, { aulaId: string }>(
  { roles: ['promotor', 'admin'], cuerpo: Cuerpo },
  async ({ usuario, cuerpo, params }) => guardarEnlaceGrupo(usuario, params.aulaId, cuerpo.enlaceGrupo),
);
