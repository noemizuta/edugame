import { z } from 'zod';
import { ruta } from '@/lib/api';
import { aulasAdmin, crearAula } from '@/lib/servicios/admin';

/** Lista de aulas. */
export const GET = ruta({ roles: ['admin'] }, async ({ ahora }) => ({ aulas: await aulasAdmin(ahora) }));

const Nueva = z.object({
  nombre: z.string().trim().min(2).max(80),
  facultad: z.string().trim().min(2).max(80),
  brazo: z.enum(['experimental', 'control']),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  capacidad: z.number().int().min(1).max(30).default(30),
  prueba: z.boolean().default(false),
});

/** PA1: crea un aula con su código de unión. */
export const POST = ruta<z.infer<typeof Nueva>>({ roles: ['admin'], cuerpo: Nueva }, async ({ usuario, cuerpo, ahora }) =>
  crearAula(usuario, cuerpo, ahora),
);
