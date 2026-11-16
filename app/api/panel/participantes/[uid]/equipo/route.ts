import { z } from 'zod';
import { ruta } from '@/lib/api';
import { EQUIPOS } from '@/lib/juego';
import { cambiarEquipo } from '@/lib/servicios/panel';

const Cuerpo = z.object({ equipo: z.enum(EQUIPOS) });

/** Cambia el equipo (máximo 5 por equipo). */
export const PATCH = ruta<z.infer<typeof Cuerpo>, undefined, { uid: string }>(
  { roles: ['promotor', 'admin'], cuerpo: Cuerpo },
  async ({ usuario, cuerpo, params, ahora }) => cambiarEquipo(usuario, params.uid, cuerpo.equipo, ahora),
);
