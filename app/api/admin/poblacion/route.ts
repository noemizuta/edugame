import { ruta } from '@/lib/api';
import { poblacion } from '@/lib/servicios/personal';

/** Solo admin, a demanda: aulas y usuarios con su rol (lee un documento por usuario). */
export const GET = ruta({ roles: ['admin'] }, async () => poblacion());
