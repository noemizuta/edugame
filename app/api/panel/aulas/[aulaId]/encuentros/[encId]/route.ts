import { z } from 'zod';
import { ErrorApi, ruta } from '@/lib/api';
import { esEncuentro, guardarEncuentro } from '@/lib/servicios/panel';

const Cuerpo = z.object({
  enlace: z.string().max(500).nullable().optional(),
  codigo: z.string().max(40).optional(),
});

/** Enlace de Meet o Zoom y código de asistencia (se guarda solo su hash). */
export const PUT = ruta<z.infer<typeof Cuerpo>, undefined, { aulaId: string; encId: string }>(
  { roles: ['promotor', 'admin'], cuerpo: Cuerpo },
  async ({ usuario, cuerpo, params, ahora }) => {
    if (!esEncuentro(params.encId)) throw new ErrorApi(404, 'no_encontrado');
    return guardarEncuentro(usuario, params.aulaId, params.encId, cuerpo, ahora);
  },
);
