import { z } from 'zod';
import { ruta } from '@/lib/api';
import { marcarRetiro } from '@/lib/servicios/admin';

const Cuerpo = z.object({ retirado: z.boolean().default(true) });

/** PA4: marca el retiro (o lo deshace). */
export const POST = ruta<z.infer<typeof Cuerpo>, undefined, { uid: string }>(
  { roles: ['admin'], cuerpo: Cuerpo },
  async ({ usuario, cuerpo, params, ahora }) => marcarRetiro(usuario, params.uid, cuerpo.retirado, ahora),
);
