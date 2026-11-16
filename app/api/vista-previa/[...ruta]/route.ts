import { z } from 'zod';
import { ErrorApi, ruta } from '@/lib/api';
import { configJuego } from '@/lib/contenido';
import {
  actividadVista,
  asistencia,
  completar,
  enviarEvidencia,
  moduloVista,
  ranking,
  responder,
  yo,
} from '@/lib/servicios/participante';
import { contextoVistaPrevia } from '@/lib/servicios/vista-previa';

/**
 * PA6 · Vista previa: espejo de la API del participante (`/api/vista-previa/yo`,
 * `/api/vista-previa/actividades/{id}/responder`…) con un perfil ficticio
 * (?brazo=&dia=) y SIN escritura. Solo para el admin y el investigador.
 */
const Consulta = z.object({
  brazo: z.enum(['experimental', 'control']),
  dia: z.coerce.number().int().min(-30).max(60),
});
type Params = { ruta: string[] };
const roles = ['admin', 'investigador'] as const;

const Respuesta = z.object({
  pregunta: z.string().max(40).optional(),
  opcion: z.number().int().min(0).max(20),
  modo: z.enum(['normal', 'practica']).optional(),
});

export const GET = ruta<undefined, z.infer<typeof Consulta>, Params>({ roles, consulta: Consulta }, async ({ consulta, params, ahora }) => {
  const ctx = contextoVistaPrevia(consulta.brazo, consulta.dia, ahora);
  const [a, b] = params.ruta;
  if (a === 'yo' && !b) return { ...(await yo(ctx)), vistaPrevia: true };
  if (a === 'modulos' && b) return { ...moduloVista(ctx, b), vistaPrevia: true };
  if (a === 'actividades' && b) return { actividad: await actividadVista(ctx, b), vistaPrevia: true };
  if (a === 'ranking') return { ...(await ranking(ctx)), vistaPrevia: true };
  if (a === 'evidencias') return { evidencias: [], vistaPrevia: true };
  throw new ErrorApi(404, 'no_encontrado');
});

export const POST = ruta<unknown, z.infer<typeof Consulta>, Params>(
  { roles, consulta: Consulta, cuerpo: z.unknown() as z.ZodType<unknown> },
  async ({ consulta, params, cuerpo, ahora }) => {
    const ctx = contextoVistaPrevia(consulta.brazo, consulta.dia, ahora);
    const [a, b, c] = params.ruta;
    if (a === 'actividades' && b && c === 'responder') return { ...(await responder(ctx, b, Respuesta.parse(cuerpo))), vistaPrevia: true };
    if (a === 'actividades' && b && c === 'completar') return { ...(await completar(ctx, b)), vistaPrevia: true };
    if (a === 'actividades' && b && c === 'asistencia') {
      const { codigo } = z.object({ codigo: z.string().min(1).max(60) }).parse(cuerpo);
      return { ...(await asistencia(ctx, b, codigo)), vistaPrevia: true };
    }
    if (a === 'evidencias' && !b) {
      const e = z.object({ misionId: z.string().max(60), campos: z.record(z.string(), z.union([z.string(), z.number()])) }).parse(cuerpo);
      return { ...(await enviarEvidencia(ctx, e.misionId, e.campos)), vistaPrevia: true };
    }
    if (a === 'eventos') return { vistaPrevia: true };
    throw new ErrorApi(404, 'no_encontrado');
  },
);

export const PATCH = ruta<unknown, z.infer<typeof Consulta>, Params>(
  { roles, consulta: Consulta, cuerpo: z.unknown() as z.ZodType<unknown> },
  async ({ params, cuerpo }) => {
    if (params.ruta[0] !== 'perfil') throw new ErrorApi(404, 'no_encontrado');
    const { avatar } = z.object({ avatar: z.string() }).parse(cuerpo);
    if (!configJuego().avatares.includes(avatar)) throw new ErrorApi(400, 'avatar_invalido');
    return { avatar, siguientePaso: '/inicio', vistaPrevia: true };
  },
);
