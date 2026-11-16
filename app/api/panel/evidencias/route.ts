import { z } from 'zod';
import { ruta } from '@/lib/api';
import { evidenciasPendientes } from '@/lib/servicios/panel';

export const GET = ruta(
  { roles: ['promotor', 'admin', 'investigador'], consulta: z.object({ aulaId: z.string().min(1).max(100) }) },
  async ({ usuario, consulta }) => ({ evidencias: await evidenciasPendientes(usuario, consulta.aulaId) }),
);
