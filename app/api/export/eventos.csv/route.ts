import { z } from 'zod';
import { ruta } from '@/lib/api';
import { csvEventos, nombreArchivo } from '@/lib/servicios/panel';

const Consulta = z.object({ aulaId: z.string().min(1).max(100).optional(), incluirPrueba: z.literal('1').optional() });

/** CSV de eventos (sección 13): UTF-8 con BOM, sin correos ni nombres. */
export const GET = ruta(
  { roles: ['promotor', 'admin', 'investigador'], consulta: Consulta },
  async ({ usuario, consulta, ahora }) => {
    const csv = await csvEventos(usuario, consulta.aulaId, consulta.incluirPrueba === '1');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nombreArchivo('eventos', consulta.aulaId, ahora)}"`,
        'Cache-Control': 'no-store',
      },
    });
  },
);
