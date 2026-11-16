import { z } from 'zod';
import { ruta } from '@/lib/api';
import { buscarUsuarios } from '@/lib/servicios/personal';

const Consulta = z.object({ q: z.string().trim().min(3).max(120) });

/** Solo admin: busca un usuario por código G-XXXXX o por correo exacto. */
export const GET = ruta({ roles: ['admin'], consulta: Consulta }, async ({ usuario, consulta, ahora }) => ({
  usuarios: await buscarUsuarios(usuario, consulta.q, ahora),
}));
