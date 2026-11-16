import { z } from 'zod';
import { ruta } from '@/lib/api';
import { csvParticipantes, nombreArchivo } from '@/lib/servicios/panel';

const Consulta = z.object({ aulaId: z.string().min(1).max(100).optional(), incluirPrueba: z.literal('1').optional() });

/** CSV de participantes (sección 13): UTF-8 con BOM, sin correos ni nombres. */
export const GET = ruta(
  { roles: ['promotor', 'admin', 'investigador'], consulta: Consulta },
  async ({ usuario, consulta, ahora }) => {
    const csv = await csvParticipantes(usuario, consulta.aulaId, consulta.incluirPrueba === '1', ahora);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nombreArchivo('participantes', consulta.aulaId, ahora)}"`,
        'Cache-Control': 'no-store',
      },
    });
  },
);
