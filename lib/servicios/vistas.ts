/**
 * Vistas de las actividades para el navegador, por brazo. Regla 5: las
 * respuestas correctas (`correcta`, `responsable`) y la retroalimentación
 * NUNCA salen antes de que el participante responda. Las opciones se envían
 * en orden barajado estable y el navegador responde con la POSICIÓN mostrada.
 * SOLO SERVIDOR.
 */
import 'server-only';
import { type ActividadCaso, type ActividadReto, type Mision1, catalogo, configJuego } from '../contenido';
import { type Brazo, enlaceConCodigo, permutacion, quitarExclamacionInicial, textoResultado } from '../juego';
import type { EncuentroDoc, EvidenciaDoc, ProgresoDoc, RespuestaGuardada } from '../modelo';
import type { Actividad } from '../contenido';

// ───────────────────────── Barajado ─────────────────────────

export const semillaCaso = (uid: string, actividadId: string) => `${uid}|${actividadId}`;
export const semillaPregunta = (uid: string, actividadId: string, clave: string) => `${uid}|${actividadId}|${clave}`;
export const semillaOrdenQuiz = (uid: string) => `${uid}|mision1`;
export const semillaOpcionesQuiz = (uid: string, casoId: string) => `${uid}|mision1|${casoId}`;

/** perm[posición] = índice original. */
export const posicionDe = (perm: number[], original: number) => perm.indexOf(original);

// ───────────────────────── Tipos de vista ─────────────────────────

export interface RespuestaCasoVista {
  opcion: number; // posición mostrada
  responsable: boolean;
  opcionResponsable: number; // posición mostrada
  feedback: string;
  feedbackResponsable?: string;
}

export interface RespuestaPreguntaVista {
  opcion: number;
  correcta: boolean;
  opcionCorrecta: number;
  veredicto: string;
  explicacion: string;
}

export interface RespuestaQuizVista {
  opcion: number;
  correcta: boolean;
  opcionCorrecta: number;
  feedback: string; // HTML limpio
  feedbackCorrecta?: string;
}

interface Base {
  id: string;
  titulo: string;
  dia: number;
  moduloId: string;
  completada: boolean;
}

export type VistaActividad =
  | (Base & { tipo: 'lectura'; html: string })
  | (Base & { tipo: 'audio'; enlace: string | null; reproductor: boolean })
  | (Base & { tipo: 'enlace'; enlace: string | null; derivacion: string })
  | (Base & { tipo: 'evaluacion'; codigo: string; enlace: string | null })
  | (Base & { tipo: 'encuentro'; enlace: string | null; disponible: boolean })
  | (Base & {
      tipo: 'mision';
      instrucciones: string;
      xp: number;
      campos: { id: string; etiqueta: string; tipo: 'select' | 'numero' | 'texto' | 'textarea'; opciones?: string[] }[];
      estado: 'nueva' | 'pendiente' | 'devuelta' | 'aprobada';
      comentario: string | null;
      valores: Record<string, string | number> | null;
    })
  | (Base & VistaCasoExp)
  | (Base & VistaCasoControl)
  | (Base & {
      tipo: 'reto';
      modo: 'juego';
      tema: string;
      preguntas: { clave: string; texto: string; opciones: string[]; respuesta: RespuestaPreguntaVista | null }[];
      xp: number | null;
      caso: Base & VistaCasoExp;
    })
  | (Base & {
      tipo: 'reto';
      modo: 'lectura';
      tema: string;
      preguntas: { texto: string; respuesta: string; explicacion: string }[];
      caso: Base & VistaCasoControl;
    })
  | (Base & VistaQuiz);

export interface VistaCasoExp {
  tipo: 'caso';
  modo: 'juego';
  texto: string;
  pregunta: string;
  opciones: string[];
  respuesta: RespuestaCasoVista | null;
  retoId: string | null;
}

export interface VistaCasoControl {
  tipo: 'caso';
  modo: 'comentado';
  texto: string;
  recomendable: string;
  explicacion: string;
  otras: { texto: string; explicacion: string }[];
  retoId: string | null;
}

export interface VistaQuiz {
  tipo: 'quiz';
  intro: Mision1['intro'];
  total: number;
  xpMaximo: number;
  estado: 'nueva' | 'en_curso' | 'completada';
  casos: { id: string; titulo: string; escena: string; pregunta: string; opciones: string[]; respuesta: RespuestaQuizVista | null }[];
  resultado: { aciertos: number; total: number; texto: string; xp: number; detective: boolean } | null;
}

// ───────────────────────── Respuestas guardadas → vista ─────────────────────────

export function respuestaCaso(caso: ActividadCaso, perm: number[], r: RespuestaGuardada): RespuestaCasoVista {
  const iResp = caso.opciones.findIndex((o) => o.responsable);
  const elegida = caso.opciones[r.opcion]!;
  return {
    opcion: posicionDe(perm, r.opcion),
    responsable: elegida.responsable,
    opcionResponsable: posicionDe(perm, iResp),
    feedback: elegida.feedback,
    ...(elegida.responsable ? {} : { feedbackResponsable: caso.opciones[iResp]!.feedback }),
  };
}

export function respuestaPregunta(
  p: ActividadReto['preguntas'][number],
  perm: number[],
  r: RespuestaGuardada,
): RespuestaPreguntaVista {
  return {
    opcion: posicionDe(perm, r.opcion),
    correcta: r.opcion === p.correcta,
    opcionCorrecta: posicionDe(perm, p.correcta),
    veredicto: r.opcion === p.correcta ? '¡Correcto!' : 'No exactamente.',
    explicacion: p.explicacion,
  };
}

export function respuestaQuiz(caso: Mision1['casos'][number], perm: number[], opcionOriginal: number): RespuestaQuizVista {
  const iCorrecta = caso.opciones.findIndex((o) => o.correcta);
  const elegida = caso.opciones[opcionOriginal]!;
  return {
    opcion: posicionDe(perm, opcionOriginal),
    correcta: elegida.correcta,
    opcionCorrecta: posicionDe(perm, iCorrecta),
    feedback: elegida.feedback,
    ...(elegida.correcta ? {} : { feedbackCorrecta: caso.opciones[iCorrecta]!.feedback }),
  };
}

// ───────────────────────── Constructores ─────────────────────────

export const PREGUNTA_CASO = '¿Qué debería hacer?';

function vistaCasoExp(uid: string, caso: ActividadCaso, progreso: ProgresoDoc | null): VistaCasoExp {
  const perm = permutacion(caso.opciones.length, semillaCaso(uid, caso.id));
  const r = progreso?.respuestas?.caso;
  return {
    tipo: 'caso',
    modo: 'juego',
    texto: caso.texto,
    pregunta: PREGUNTA_CASO,
    opciones: perm.map((i) => caso.opciones[i]!.texto),
    respuesta: r ? respuestaCaso(caso, perm, r) : null,
    retoId: caso.retoId ?? null,
  };
}

/** Caso comentado del control: sin la frase inicial de juego «¡…!». */
function vistaCasoControl(caso: ActividadCaso): VistaCasoControl {
  const resp = caso.opciones.find((o) => o.responsable)!;
  return {
    tipo: 'caso',
    modo: 'comentado',
    texto: caso.texto,
    recomendable: resp.texto,
    explicacion: quitarExclamacionInicial(resp.feedback),
    otras: caso.opciones
      .filter((o) => !o.responsable)
      .map((o) => ({ texto: o.texto, explicacion: quitarExclamacionInicial(o.feedback) })),
    retoId: caso.retoId ?? null,
  };
}

export function vistaQuiz(uid: string, m: Mision1, progreso: ProgresoDoc | null): VistaQuiz {
  const orden = permutacion(m.casos.length, semillaOrdenQuiz(uid));
  const completada = progreso?.estado === 'completada';
  const casos = orden.map((i) => {
    const c = m.casos[i]!;
    const perm = permutacion(c.opciones.length, semillaOpcionesQuiz(uid, c.id));
    const r = progreso?.respuestas?.[c.id];
    return {
      id: c.id,
      titulo: c.titulo,
      escena: c.escena,
      pregunta: c.pregunta,
      opciones: perm.map((j) => c.opciones[j]!.texto),
      respuesta: r ? respuestaQuiz(c, perm, r.opcion) : null,
    };
  });
  const aciertos = progreso?.puntaje ?? 0;
  return {
    tipo: 'quiz',
    intro: m.intro,
    total: m.casos.length,
    xpMaximo: m.xpMaximo,
    estado: completada ? 'completada' : progreso ? 'en_curso' : 'nueva',
    casos,
    resultado: completada
      ? {
          aciertos,
          total: m.casos.length,
          texto: textoResultado(aciertos, m.casos.length, m.resultadoFinal),
          xp: progreso!.xp,
          detective: aciertos / m.casos.length >= m.umbralInsignia,
        }
      : null,
  };
}

export interface DatosVista {
  uid: string;
  codigo: string;
  brazo: Brazo;
  moduloId: string;
  progreso: ProgresoDoc | null;
  /** Para retos: progreso del microcaso `caso-sN`. */
  progresoCaso?: ProgresoDoc | null;
  enlaceGrupo?: string | null;
  enlacesEstudio?: Record<string, string | null>;
  encuentro?: EncuentroDoc | null;
  evidencia?: EvidenciaDoc | null;
}

const ES_AUDIO = /\.(mp3|m4a|ogg)(\?.*)?$/i;

/** Vista saneada de una actividad para el brazo del participante. */
export function vistaActividad(a: Actividad, d: DatosVista): VistaActividad {
  const base: Base = {
    id: a.id,
    titulo: a.titulo,
    dia: a.dia,
    moduloId: d.moduloId,
    completada: d.progreso?.estado === 'completada',
  };
  const exp = d.brazo === 'experimental';

  switch (a.tipo) {
    case 'lectura':
      return { ...base, tipo: 'lectura', html: a.html };
    case 'audio': {
      const enlace = a.enlace.trim() || null;
      return { ...base, tipo: 'audio', enlace, reproductor: !!enlace && ES_AUDIO.test(enlace) };
    }
    case 'enlace':
      return { ...base, tipo: 'enlace', enlace: d.enlaceGrupo || null, derivacion: configJuego().derivacion };
    case 'evaluacion': {
      const clave = a.enlaceConfig.split('.').pop()!;
      const url = d.enlacesEstudio?.[clave] || null;
      return { ...base, tipo: 'evaluacion', codigo: d.codigo, enlace: url ? enlaceConCodigo(url, d.codigo) : null };
    }
    case 'encuentro':
      return { ...base, tipo: 'encuentro', enlace: d.encuentro?.enlace || null, disponible: !!d.encuentro?.codigoHash };
    case 'mision': {
      const ev = d.evidencia ?? null;
      const estado = base.completada ? 'aprobada' : ev ? (ev.estado === 'aprobada' ? 'aprobada' : ev.estado) : 'nueva';
      return {
        ...base,
        tipo: 'mision',
        instrucciones: a.instrucciones,
        xp: a.xp,
        campos: a.campos,
        estado,
        comentario: ev?.estado === 'devuelta' ? ev.comentario : null,
        valores: ev?.campos ?? null,
      };
    }
    case 'caso':
      return { ...base, ...(exp ? vistaCasoExp(d.uid, a, d.progreso) : vistaCasoControl(a)) };
    case 'reto': {
      const casoInfo = catalogo().actividades.get(a.casoId)!;
      const caso = casoInfo.actividad as Extract<Actividad, { tipo: 'caso' }>;
      const baseCaso: Base = {
        id: caso.id,
        titulo: caso.titulo,
        dia: caso.dia,
        moduloId: d.moduloId,
        completada: d.progresoCaso?.estado === 'completada',
      };
      if (!exp) {
        return {
          ...base,
          tipo: 'reto',
          modo: 'lectura',
          tema: a.tema,
          preguntas: a.preguntas.map((p) => ({ texto: p.texto, respuesta: p.opciones[p.correcta]!, explicacion: p.explicacion })),
          caso: { ...baseCaso, ...vistaCasoControl(caso) },
        };
      }
      return {
        ...base,
        tipo: 'reto',
        modo: 'juego',
        tema: a.tema,
        preguntas: a.preguntas.map((p, k) => {
          const clave = `p${k}`;
          const perm = permutacion(p.opciones.length, semillaPregunta(d.uid, a.id, clave));
          const r = d.progreso?.respuestas?.[clave];
          return { clave, texto: p.texto, opciones: perm.map((i) => p.opciones[i]!), respuesta: r ? respuestaPregunta(p, perm, r) : null };
        }),
        xp: base.completada ? (d.progreso?.xp ?? 0) : null,
        caso: { ...baseCaso, ...vistaCasoExp(d.uid, caso, d.progresoCaso ?? null) },
      };
    }
    case 'quiz':
      return { ...base, ...vistaQuiz(d.uid, catalogo().mision1, d.progreso) };
  }
}
