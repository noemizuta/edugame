import { z } from 'zod';
import { ruta } from '@/lib/api';
import { aceptarConsentimiento } from '@/lib/servicios/sesion';

export const POST = ruta(
  { roles: ['estudiante'], cuerpo: z.object({ version: z.string().min(1).max(20) }) },
  async ({ usuario, cuerpo, ahora }) => aceptarConsentimiento(usuario, cuerpo.version, ahora),
);
