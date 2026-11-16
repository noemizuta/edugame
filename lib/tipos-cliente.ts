/** Tipos de las respuestas de la API que usa el navegador (solo tipos: no importa código del servidor). */
import type { yo } from './servicios/participante';

export type DatosYo = Awaited<ReturnType<typeof yo>>;
