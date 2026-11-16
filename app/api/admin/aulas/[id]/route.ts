import { z } from 'zod';
import { ruta } from '@/lib/api';
import { editarAula } from '@/lib/servicios/admin';

const Cambios = z.object({
  activa: z.boolean().optional(),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nombre: z.string().trim().min(2).max(80).optional(),
  facultad: z.string().trim().min(2).max(80).optional(),
  capacidad: z.number().int().min(1).max(30).optional(),
  regenerarCodigo: z.boolean().optional(),
});

/** PA1: activar o desactivar, cambiar la fecha de inicio o el nombre, regenerar el código. */
export const PATCH = ruta<z.infer<typeof Cambios>, undefined, { id: string }>(
  { roles: ['admin'], cuerpo: Cambios },
  async ({ usuario, cuerpo, params, ahora }) => editarAula(usuario, params.id, cuerpo, ahora),
);
