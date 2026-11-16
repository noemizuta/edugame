import { z } from 'zod';
import { ruta } from '@/lib/api';
import { ROLES } from '@/lib/juego';
import { cambiarRol } from '@/lib/servicios/personal';

const Cuerpo = z.object({
  rol: z.enum(ROLES),
  aulasPromotor: z.array(z.string().min(1).max(100)).max(50).default([]),
});

/** Cambia el rol de un usuario registrado (solo admin; decisión 6). */
export const PATCH = ruta<z.infer<typeof Cuerpo>, undefined, { uid: string }>(
  { roles: ['admin'], cuerpo: Cuerpo },
  async ({ usuario, cuerpo, params, ahora }) => ({
    usuario: await cambiarRol(usuario, params.uid, cuerpo.rol, cuerpo.aulasPromotor, ahora),
  }),
);
