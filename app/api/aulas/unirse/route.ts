import { z } from 'zod';
import { ruta } from '@/lib/api';
import { unirseAula } from '@/lib/servicios/sesion';

export const POST = ruta(
  { roles: ['estudiante'], requiere: 'consentimiento', cuerpo: z.object({ codigo: z.string().max(20) }) },
  async ({ usuario, cuerpo, ahora }) => unirseAula(usuario, cuerpo.codigo, ahora),
);
