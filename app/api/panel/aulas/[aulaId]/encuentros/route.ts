import { ruta } from '@/lib/api';
import { encuentrosAula } from '@/lib/servicios/panel';

export const GET = ruta<undefined, undefined, { aulaId: string }>(
  { roles: ['promotor', 'admin', 'investigador'] },
  async ({ usuario, params }) => encuentrosAula(usuario, params.aulaId),
);
