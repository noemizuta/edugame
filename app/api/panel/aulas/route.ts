import { ruta } from '@/lib/api';
import { aulasDelPanel } from '@/lib/servicios/panel';

/** Aulas del promotor (o todas, para admin e investigador). */
export const GET = ruta({ roles: ['promotor', 'admin', 'investigador'] }, async ({ usuario, ahora }) => ({
  aulas: await aulasDelPanel(usuario, ahora),
}));
