import { z } from 'zod';
import { ruta } from '@/lib/api';
import { guardarConfig, leerConfig } from '@/lib/servicios/admin';

/** PA5: enlaces de O1, O2, satisfacción, O3 y servicio médico (admiten {codigo}). */
export const GET = ruta({ roles: ['admin'] }, async () => leerConfig());

const Enlace = z.string().max(600).nullable().optional();
const Cuerpo = z.object({
  enlaces: z.object({ o1: Enlace, o2: Enlace, satisfaccion: Enlace, o3: Enlace, servicioMedico: Enlace }),
});

export const PUT = ruta<z.infer<typeof Cuerpo>>({ roles: ['admin'], cuerpo: Cuerpo }, async ({ usuario, cuerpo, ahora }) =>
  guardarConfig(usuario, cuerpo.enlaces, ahora),
);
