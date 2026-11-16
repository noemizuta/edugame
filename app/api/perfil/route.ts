import { z } from 'zod';
import { ruta } from '@/lib/api';
import { guardarAvatar } from '@/lib/servicios/sesion';

export const PATCH = ruta(
  { roles: ['estudiante'], requiere: 'aula', cuerpo: z.object({ avatar: z.string().min(1).max(20) }) },
  async ({ usuario, cuerpo, ahora }) => guardarAvatar(usuario, cuerpo.avatar, ahora),
);
