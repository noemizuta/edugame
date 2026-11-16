/**
 * Servicios del participante (sección 8). Leen con un `Lector` y devuelven
 * escrituras que el `Almacen` aplica en una transacción. Reglas:
 * - cuenta el primer intento; la práctica no da puntos; nunca hay puntos negativos;
 * - el control no recibe XP, pero sí se registran sus actividades y eventos;
 * - máximo 60 XP por acción; una actividad cerrada responde 403.
 * SOLO SERVIDOR.
 */
import 'server-only';
import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import type { Usuario } from '../api';
import {
  type Actividad,
  type ActividadCaso,
  type ActividadReto,
  type Modulo,
  calendario,
  catalogo,
  configJuego,
  modulosDelBrazo,
} from '../contenido';
import { ErrorApi } from '../errores';
import {
  type Brazo,
  type MisionSemana,
  estaAbierto,
  estadoModulo,
  fechaApertura,
  fechaCorta,
  idReto,
  insignias,
  limiteAgotado,
  misionDeLaSemana,
  nivel,
  normalizarCodigoAsistencia,
  permutacion,
  racha,
  rankingEquipos,
  diaEstudio,
  sumarFallo,
  textoFase,
  textoResultado,
  topeXp,
  xpQuiz,
  xpReto,
} from '../juego';
import type { EvidenciaDoc, ProgresoDoc, ResumenActividad, TipoEvento } from '../modelo';
import type { Almacen, Aula, Escritura, Lector } from './almacen';
import { nuevoEvento } from './eventos';
import {
  type RespuestaQuizVista,
  respuestaCaso,
  respuestaPregunta,
  respuestaQuiz,
  semillaCaso,
  semillaOpcionesQuiz,
  semillaOrdenQuiz,
  semillaPregunta,
  vistaActividad,
} from './vistas';

export interface Ctx {
  usuario: Usuario;
  aula: Aula;
  brazo: Brazo;
  /** Día del estudio del aula (1 = fechaInicio). */
  dia: number;
  ahora: Date;
  almacen: Almacen;
}

const MAX_INTENTOS_ASISTENCIA = 10;

export async function contexto(usuario: Usuario, almacen: Almacen, ahora: Date): Promise<Ctx> {
  if (!usuario.aulaId || !usuario.brazo) throw new ErrorApi(409, 'paso_pendiente', { siguientePaso: '/unirse' });
  const aula = await almacen.lector().aula(usuario.aulaId);
  if (!aula) throw new ErrorApi(409, 'paso_pendiente', { siguientePaso: '/unirse' });
  return {
    usuario,
    aula,
    brazo: usuario.brazo,
    dia: diaEstudio(aula.fechaInicio, ahora),
    ahora,
    almacen,
  };
}

// ───────────────────────── Utilidades ─────────────────────────

const resumenDe = (ctx: Ctx): Record<string, ResumenActividad> => ctx.usuario.resumen ?? {};
const completadaEn = (r: Record<string, ResumenActividad>) => (id: string) => r[id]?.estado === 'completada';
/** Completada, o misión de campo enviada y en revisión: ya no está pendiente para el participante. */
const hechaEn = (r: Record<string, ResumenActividad>) => (id: string) => r[id]?.estado === 'completada' || r[id]?.enviada === true;

const ts = (ctx: Ctx) => Timestamp.fromDate(ctx.ahora);
const esExp = (ctx: Ctx) => ctx.brazo === 'experimental';

function evento(ctx: Ctx, tipo: TipoEvento, extra: Parameters<typeof nuevoEvento>[5] = {}): Escritura {
  return { tipo: 'evento', evento: nuevoEvento(ctx.usuario.uid, ctx.usuario, ctx.aula, tipo, ctx.ahora, extra) };
}

function escrituraProgreso(ctx: Ctx, actividadId: string, doc: ProgresoDoc, xp: number): Escritura {
  const resumen: ResumenActividad = { estado: doc.estado };
  if (doc.puntaje !== undefined) resumen.puntaje = doc.puntaje;
  if (doc.max !== undefined) resumen.max = doc.max;
  if (doc.responsable !== undefined) resumen.responsable = doc.responsable;
  if (doc.enviada !== undefined) resumen.enviada = doc.enviada;
  // Un reto completado marca el día para la racha (decisión 7).
  const esReto = catalogo().actividades.get(actividadId)?.actividad.tipo === 'reto';
  const diaReto = esReto && doc.estado === 'completada' && ctx.dia >= 1 ? ctx.dia : undefined;
  return { tipo: 'progreso', uid: ctx.usuario.uid, actividadId, doc, resumen, xp, ...(diaReto ? { diaReto } : {}) };
}

/** XP de una acción: 0 en el control, con el tope de 60. */
const xpDe = (ctx: Ctx, xp: number) => (esExp(ctx) ? topeXp(xp, configJuego().xp.maxPorAccion) : 0);

const linkActividad = (a: Actividad) => `/actividad/${a.tipo === 'caso' && a.retoId ? a.retoId : a.id}`;

// ───────────────────────── Acceso ─────────────────────────

function moduloDelBrazo(ctx: Ctx, id: string): Modulo {
  const m = modulosDelBrazo(ctx.brazo).find((x) => x.id === id);
  if (!m) throw new ErrorApi(404, 'no_encontrado');
  return m;
}

/** Actividad visible para el brazo y abierta en el día del estudio del aula; si no, 404 o 403. */
export function acceso(ctx: Ctx, actividadId: string): { actividad: Actividad; modulo: Modulo } {
  const info = catalogo().actividades.get(actividadId);
  if (!info) throw new ErrorApi(404, 'no_encontrado');
  const modulo = moduloDelBrazo(ctx, info.moduloId);
  const actividad = modulo.items.find((a) => a.id === actividadId);
  if (!actividad) throw new ErrorApi(404, 'no_encontrado');
  if (!estaAbierto(modulo, ctx.dia) || !estaAbierto(actividad, ctx.dia)) {
    const abre = fechaApertura(ctx.aula.fechaInicio, Math.max(modulo.dia, actividad.dia));
    throw new ErrorApi(403, 'actividad_cerrada', { abre: fechaCorta(abre) });
  }
  return { actividad, modulo };
}

// ───────────────────────── GET /api/yo ─────────────────────────

/**
 * ¿Cuenta como pendiente? No: enlaces, podcasts sin enlace, evaluaciones sin
 * formulario configurado ni microcasos (cuentan dentro de su reto).
 */
function cuentaComoPendiente(enlaces: Record<string, string | null> | undefined) {
  return (i: { id: string; tipo: string }) => {
    const a = catalogo().actividades.get(i.id)?.actividad;
    if (!a || a.tipo === 'enlace') return false;
    if (a.tipo === 'audio') return !!a.enlace.trim();
    if (a.tipo === 'evaluacion') return !!enlaces?.[a.enlaceConfig.split('.').pop()!];
    if (a.tipo === 'caso' && a.retoId) return false;
    return true;
  };
}

/** Hecha; un reto solo está hecho cuando también lo está su microcaso. */
function hechaConMicrocaso(r: Record<string, ResumenActividad>) {
  const h = hechaEn(r);
  return (id: string) => {
    const a = catalogo().actividades.get(id)?.actividad;
    return h(id) && (a?.tipo !== 'reto' || h(a.casoId));
  };
}

export async function yo(ctx: Ctx) {
  const cfg = configJuego();
  const cal = calendario();
  const r = resumenDe(ctx);
  const exp = esExp(ctx);
  const modulos = modulosDelBrazo(ctx.brazo);
  const hecha = hechaConMicrocaso(r);
  const enlaces = (await ctx.almacen.lector().configEstudio())?.enlaces as Record<string, string | null> | undefined;
  const cuenta = cuentaComoPendiente(enlaces);

  const ms: MisionSemana = misionDeLaSemana(modulos, ctx.dia, hecha, cuenta);
  let semanal: { tipo: MisionSemana['tipo']; titulo?: string; enlace?: string; texto: string };
  if (ms.tipo === 'actividad') {
    const a = catalogo().actividades.get(ms.actividadId)!.actividad;
    const titulo = a.tipo === 'caso' && a.retoId ? catalogo().actividades.get(a.retoId)!.actividad.titulo : a.titulo;
    semanal = { tipo: 'actividad', titulo, enlace: linkActividad(a), texto: titulo };
  } else if (ms.tipo === 'antes_inicio') {
    semanal = { tipo: ms.tipo, texto: cal.textos.antesDelInicio };
  } else {
    semanal = { tipo: ms.tipo, texto: cal.textos.alDia };
  }

  const vistaModulos = modulos.map((m) => ({
    id: m.id,
    grupo: exp ? m.grupo : (cfg.nombresControl.grupos[m.grupo] ?? m.grupo),
    color: m.color,
    icono: m.icono,
    titulo: exp ? m.titulo : (m.tituloControl ?? m.titulo),
    estado: estadoModulo(m, ctx.dia, ctx.aula.fechaInicio, hecha, cuenta),
  }));

  const base = {
    perfil: { codigo: ctx.usuario.codigo, avatar: ctx.usuario.avatar, brazo: ctx.brazo },
    aula: { nombre: ctx.aula.nombre, brazo: ctx.aula.brazo, enlaceGrupo: ctx.aula.enlaceGrupo },
    dia: ctx.dia,
    fase: textoFase(ctx.dia, cfg.fases),
    semanal,
    tarjetaSemana: exp ? cal.textos.tarjetaExperimental : cal.textos.tarjetaControl,
    modulos: vistaModulos,
    derivacion: cfg.derivacion,
  };
  if (!exp) return { ...base, juego: null };

  const rachaActual = racha(ctx.usuario.diasConReto ?? [], ctx.dia);
  const xp = ctx.usuario.xp ?? 0;
  return {
    ...base,
    juego: {
      xp,
      equipo: ctx.usuario.equipo,
      nivel: nivel(xp, cfg.niveles),
      racha: rachaActual,
      insignias: insignias(cfg.insignias, { progreso: r, xp, racha: rachaActual }),
    },
  };
}

// ───────────────────────── GET /api/modulos/[id] ─────────────────────────

export function moduloVista(ctx: Ctx, id: string) {
  const m = moduloDelBrazo(ctx, id);
  if (!estaAbierto(m, ctx.dia)) {
    throw new ErrorApi(403, 'modulo_cerrado', { abre: fechaCorta(fechaApertura(ctx.aula.fechaInicio, m.dia)) });
  }
  const exp = esExp(ctx);
  const r = resumenDe(ctx);
  return {
    modulo: {
      id: m.id,
      icono: m.icono,
      color: m.color,
      titulo: exp ? m.titulo : (m.tituloControl ?? m.titulo),
      // Decisión 1: el control solo ve `descripcionControl`, si existe.
      descripcion: exp ? m.descripcion : (m.descripcionControl ?? null),
    },
    actividades: m.items
      .filter((a) => !(a.tipo === 'caso' && a.retoId)) // el microcaso va dentro de su reto
      .map((a) => {
        const abierta = estaAbierto(a, ctx.dia);
        const e = r[a.id];
        const estado = e?.estado === 'completada' ? 'completada' : e?.enviada ? 'enviada' : abierta ? 'abierta' : 'cerrada';
        return {
          id: a.id,
          tipo: a.tipo,
          titulo: a.titulo,
          estado,
          abre: abierta ? null : fechaCorta(fechaApertura(ctx.aula.fechaInicio, a.dia)),
        };
      }),
  };
}

// ───────────────────────── GET /api/actividades/[id] ─────────────────────────

export async function actividadVista(ctx: Ctx, id: string) {
  const { actividad, modulo } = acceso(ctx, id);
  const l = ctx.almacen.lector();
  const uid = ctx.usuario.uid;
  const [progreso, progresoCaso, config, encuentro, evidencias] = await Promise.all([
    l.progreso(uid, id),
    actividad.tipo === 'reto' ? l.progreso(uid, actividad.casoId) : Promise.resolve(null),
    actividad.tipo === 'evaluacion' ? l.configEstudio() : Promise.resolve(null),
    actividad.tipo === 'encuentro' ? l.encuentro(ctx.aula.id, actividad.id) : Promise.resolve(null),
    actividad.tipo === 'mision' ? l.evidencias(uid, actividad.id) : Promise.resolve([]),
  ]);
  return vistaActividad(actividad, {
    uid,
    codigo: ctx.usuario.codigo ?? '',
    brazo: ctx.brazo,
    moduloId: modulo.id,
    progreso,
    progresoCaso,
    enlaceGrupo: ctx.aula.enlaceGrupo,
    enlacesEstudio: config?.enlaces,
    encuentro,
    evidencia: evidencias[0] ?? null,
  });
}

// ───────────────────────── POST responder ─────────────────────────

export interface EntradaRespuesta {
  pregunta?: string;
  opcion: number;
  modo?: 'normal' | 'practica';
}

function validarOpcion(opcion: number, n: number) {
  if (!Number.isInteger(opcion) || opcion < 0 || opcion >= n) throw new ErrorApi(400, 'opcion_invalida');
}

export async function responder(ctx: Ctx, id: string, entrada: EntradaRespuesta) {
  const { actividad, modulo } = acceso(ctx, id);
  if (actividad.tipo !== 'caso' && actividad.tipo !== 'reto' && actividad.tipo !== 'quiz') {
    throw new ErrorApi(400, 'tipo_invalido');
  }
  // El control lee los casos y retos comentados: no responde ni recibe puntos.
  if (!esExp(ctx)) throw new ErrorApi(403, 'solo_experimental');
  if (entrada.modo === 'practica' && actividad.tipo !== 'quiz') throw new ErrorApi(400, 'practica_no_disponible');

  switch (actividad.tipo) {
    case 'caso':
      return responderCaso(ctx, actividad, modulo.id, entrada.opcion);
    case 'reto':
      return responderReto(ctx, actividad, modulo.id, entrada);
    case 'quiz':
      return responderQuiz(ctx, modulo.id, entrada);
  }
}

function responderCaso(ctx: Ctx, caso: ActividadCaso, moduloId: string, opcion: number) {
  const uid = ctx.usuario.uid;
  const perm = permutacion(caso.opciones.length, semillaCaso(uid, caso.id));
  validarOpcion(opcion, caso.opciones.length);

  return ctx.almacen.transaccion(async (l) => {
    const p = await l.progreso(uid, caso.id);
    const previa = p?.respuestas?.caso;
    if (previa) {
      const v = respuestaCaso(caso, perm, previa);
      return {
        resultado: { ...v, correcta: v.responsable, opcionCorrecta: v.opcionResponsable, feedbackCorrecta: v.feedbackResponsable, completada: true, xpOtorgado: 0, yaRespondida: true },
        escrituras: [],
      };
    }
    const original = perm[opcion]!;
    const responsable = caso.opciones[original]!.responsable;
    const xp = xpDe(ctx, responsable ? configJuego().xp.casoResponsable : 0);
    const en = ts(ctx);
    const doc: ProgresoDoc = {
      estado: 'completada',
      xp,
      opcion: original,
      responsable,
      respuestas: { caso: { opcion: original, correcta: responsable, en } },
      completadaEn: en,
    };
    const v = respuestaCaso(caso, perm, doc.respuestas.caso!);
    return {
      resultado: { ...v, correcta: responsable, opcionCorrecta: v.opcionResponsable, feedbackCorrecta: v.feedbackResponsable, completada: true, xpOtorgado: xp },
      escrituras: [
        escrituraProgreso(ctx, caso.id, doc, xp),
        evento(ctx, 'respuesta', { modulo: moduloId, actividadId: caso.id, pregunta: 'caso', opcion: original, correcta: responsable }),
        evento(ctx, 'completar', { modulo: moduloId, actividadId: caso.id, xp }),
      ],
    };
  });
}

function responderReto(ctx: Ctx, reto: ActividadReto, moduloId: string, entrada: EntradaRespuesta) {
  const uid = ctx.usuario.uid;
  const k = /^p([0-9])$/.exec(entrada.pregunta ?? '')?.[1];
  const pregunta = k !== undefined ? reto.preguntas[Number(k)] : undefined;
  if (!pregunta) throw new ErrorApi(400, 'pregunta_invalida');
  const clave = `p${k}`;
  const perm = permutacion(pregunta.opciones.length, semillaPregunta(uid, reto.id, clave));
  validarOpcion(entrada.opcion, pregunta.opciones.length);

  return ctx.almacen.transaccion(async (l) => {
    const p = await l.progreso(uid, reto.id);
    const previa = p?.respuestas?.[clave];
    if (previa) {
      const v = respuestaPregunta(pregunta, perm, previa);
      return {
        resultado: { ...v, feedback: v.explicacion, completada: p?.estado === 'completada', xpOtorgado: 0, yaRespondida: true },
        escrituras: [],
      };
    }
    const en = ts(ctx);
    const original = perm[entrada.opcion]!;
    const correcta = original === pregunta.correcta;
    const respuestas = { ...(p?.respuestas ?? {}), [clave]: { opcion: original, correcta, en } };
    const completa = reto.preguntas.every((_, i) => respuestas[`p${i}`]);
    const escrituras: Escritura[] = [
      evento(ctx, 'respuesta', { modulo: moduloId, actividadId: reto.id, pregunta: clave, opcion: original, correcta }),
    ];

    let doc: ProgresoDoc;
    let xp = 0;
    if (completa) {
      const aciertos = Object.values(respuestas).filter((r) => r.correcta).length;
      const anterior = await l.progreso(uid, idReto(reto.semana - 1));
      const cfg = configJuego().xp;
      xp = xpDe(ctx, xpReto(aciertos, anterior?.estado === 'completada', cfg.retoCorrecta, cfg.rachaSemana));
      doc = { estado: 'completada', xp, puntaje: aciertos, max: reto.preguntas.length, correctas: aciertos, respuestas, completadaEn: en };
      escrituras.push(evento(ctx, 'completar', { modulo: moduloId, actividadId: reto.id, puntaje: aciertos, max: doc.max, xp }));
    } else {
      doc = { estado: 'en_curso', xp: 0, respuestas, completadaEn: null };
    }
    escrituras.unshift(escrituraProgreso(ctx, reto.id, doc, xp));
    const v = respuestaPregunta(pregunta, perm, respuestas[clave]!);
    return { resultado: { ...v, feedback: v.explicacion, completada: completa, xpOtorgado: xp }, escrituras };
  });
}

type ResultadoQuiz = RespuestaQuizVista & {
  xpOtorgado: number;
  practica?: boolean;
  yaRespondida?: boolean;
  completada?: boolean;
  resultado?: { aciertos: number; total: number; texto: string; xp: number; detective: boolean } | null;
};

function responderQuiz(ctx: Ctx, moduloId: string, entrada: EntradaRespuesta) {
  const uid = ctx.usuario.uid;
  const m = catalogo().mision1;
  const caso = m.casos.find((c) => c.id === entrada.pregunta);
  if (!caso) throw new ErrorApi(400, 'pregunta_invalida');
  const perm = permutacion(caso.opciones.length, semillaOpcionesQuiz(uid, caso.id));
  validarOpcion(entrada.opcion, caso.opciones.length);
  const original = perm[entrada.opcion]!;

  return ctx.almacen.transaccion<ResultadoQuiz>(async (l) => {
    const p = await l.progreso(uid, m.id);
    const completada = p?.estado === 'completada';

    // Práctica: solo tras completar la misión; devuelve retroalimentación sin guardar el resultado.
    if (entrada.modo === 'practica') {
      // En la vista previa (sin escritura) siempre se puede practicar.
      if (!completada && ctx.almacen.escribe) throw new ErrorApi(409, 'practica_no_disponible');
      const v = respuestaQuiz(caso, perm, original);
      return {
        resultado: { ...v, practica: true, xpOtorgado: 0 },
        escrituras: [
          evento(ctx, 'practica', { modulo: moduloId, actividadId: m.id, pregunta: caso.id, opcion: original, correcta: v.correcta }),
        ],
      };
    }
    if (completada) throw new ErrorApi(409, 'ya_completada');

    const previa = p?.respuestas?.[caso.id];
    if (previa) return { resultado: { ...respuestaQuiz(caso, perm, previa.opcion), xpOtorgado: 0, yaRespondida: true }, escrituras: [] };

    // No se puede saltar ni volver atrás: solo se responde el primer caso pendiente del orden del usuario.
    const orden = permutacion(m.casos.length, semillaOrdenQuiz(uid)).map((i) => m.casos[i]!);
    const siguiente = orden.find((c) => !p?.respuestas?.[c.id]);
    // En la vista previa no se guarda el avance, así que no se exige el orden.
    if (ctx.almacen.escribe && siguiente?.id !== caso.id) throw new ErrorApi(409, 'orden_invalido');

    const en = ts(ctx);
    const v = respuestaQuiz(caso, perm, original);
    const respuestas = { ...(p?.respuestas ?? {}), [caso.id]: { opcion: original, correcta: v.correcta, en } };
    const total = m.casos.length;
    const terminada = Object.keys(respuestas).length === total;
    const escrituras: Escritura[] = [
      evento(ctx, 'respuesta', { modulo: moduloId, actividadId: m.id, pregunta: caso.id, opcion: original, correcta: v.correcta }),
    ];
    let xp = 0;
    let doc: ProgresoDoc = { estado: 'en_curso', xp: 0, respuestas, completadaEn: null };
    let resultado: ResultadoQuiz['resultado'] = null;
    if (terminada) {
      const aciertos = Object.values(respuestas).filter((r) => r.correcta).length;
      xp = xpDe(ctx, xpQuiz(aciertos, total, m.xpMaximo));
      doc = { estado: 'completada', xp, puntaje: aciertos, max: total, correctas: aciertos, respuestas, completadaEn: en };
      resultado = {
        aciertos,
        total,
        texto: textoResultado(aciertos, total, m.resultadoFinal),
        xp,
        detective: aciertos / total >= m.umbralInsignia,
      };
      escrituras.push(evento(ctx, 'completar', { modulo: moduloId, actividadId: m.id, puntaje: aciertos, max: total, xp }));
    }
    escrituras.unshift(escrituraProgreso(ctx, m.id, doc, xp));
    return { resultado: { ...v, completada: terminada, xpOtorgado: xp, resultado }, escrituras };
  });
}

// ───────────────────────── POST completar ─────────────────────────

export async function completar(ctx: Ctx, id: string) {
  const { actividad, modulo } = acceso(ctx, id);
  const exp = esExp(ctx);
  const cfg = configJuego().xp;
  const uid = ctx.usuario.uid;

  let xpBase = 0;
  const ids = [actividad.id];
  switch (actividad.tipo) {
    case 'lectura':
      break;
    case 'audio':
      if (!actividad.enlace.trim()) throw new ErrorApi(409, 'no_disponible');
      xpBase = cfg.podcast;
      break;
    case 'evaluacion': {
      const enlaces = (await ctx.almacen.lector().configEstudio())?.enlaces as Record<string, string | null> | undefined;
      if (!enlaces?.[actividad.enlaceConfig.split('.').pop()!]) throw new ErrorApi(409, 'no_disponible');
      xpBase = cfg.evaluacion;
      break;
    }
    case 'caso':
    case 'reto':
      // En el control, el caso comentado y la lectura del reto se marcan como leídos.
      if (exp) throw new ErrorApi(400, 'tipo_invalido');
      if (actividad.tipo === 'reto') ids.push(actividad.casoId);
      break;
    default:
      throw new ErrorApi(400, 'tipo_invalido');
  }

  return ctx.almacen.transaccion(async (l) => {
    const previos = await Promise.all(ids.map((x) => l.progreso(uid, x)));
    const escrituras: Escritura[] = [];
    let xpTotal = 0;
    const en = ts(ctx);
    ids.forEach((x, i) => {
      if (previos[i]?.estado === 'completada') return;
      const xp = i === 0 ? xpDe(ctx, xpBase) : 0;
      xpTotal += xp;
      escrituras.push(
        escrituraProgreso(ctx, x, { estado: 'completada', xp, respuestas: {}, completadaEn: en }, xp),
        evento(ctx, 'completar', { modulo: modulo.id, actividadId: x, xp }),
      );
    });
    return { resultado: { completada: true, xpOtorgado: xpTotal }, escrituras };
  });
}

// ───────────────────────── POST asistencia ─────────────────────────

export const hashCodigoAsistencia = (codigo: string) =>
  createHash('sha256').update(normalizarCodigoAsistencia(codigo)).digest('hex');

export async function asistencia(ctx: Ctx, id: string, codigo: string) {
  const { actividad, modulo } = acceso(ctx, id);
  if (actividad.tipo !== 'encuentro') throw new ErrorApi(400, 'tipo_invalido');
  const uid = ctx.usuario.uid;
  const clave = `asistencia_${actividad.id}`;

  const r = await ctx.almacen.transaccion<{ error?: ErrorApi; completada?: boolean; xpOtorgado?: number }>(async (l) => {
    const p = await l.progreso(uid, actividad.id);
    if (p?.estado === 'completada') return { resultado: { completada: true, xpOtorgado: 0 }, escrituras: [] };

    const lim = (await l.limite(uid))?.ventanas?.[clave];
    const ventana = lim ? { desde: lim.desde.toMillis(), intentos: lim.intentos } : undefined;
    if (limiteAgotado(ventana, ctx.ahora.getTime(), MAX_INTENTOS_ASISTENCIA)) {
      return { resultado: { error: new ErrorApi(429, 'demasiados_intentos') }, escrituras: [] };
    }
    const enc = await l.encuentro(ctx.aula.id, actividad.id);
    if (!enc?.codigoHash) return { resultado: { error: new ErrorApi(409, 'sin_codigo') }, escrituras: [] };

    const correcta = hashCodigoAsistencia(codigo) === enc.codigoHash;
    const escrituras: Escritura[] = [
      evento(ctx, 'asistencia_intento', { modulo: modulo.id, actividadId: actividad.id, correcta }),
    ];
    if (!correcta) {
      const nueva = sumarFallo(ventana, ctx.ahora.getTime());
      escrituras.push({ tipo: 'limite', uid, clave, ...nueva });
      return { resultado: { error: new ErrorApi(400, 'codigo_asistencia_incorrecto') }, escrituras };
    }
    const xp = xpDe(ctx, configJuego().xp.encuentro);
    escrituras.push(
      escrituraProgreso(ctx, actividad.id, { estado: 'completada', xp, respuestas: {}, completadaEn: ts(ctx) }, xp),
      evento(ctx, 'completar', { modulo: modulo.id, actividadId: actividad.id, xp }),
    );
    return { resultado: { completada: true, xpOtorgado: xp }, escrituras };
  });
  if (r.error) throw r.error;
  return { completada: true, xpOtorgado: r.xpOtorgado ?? 0 };
}

// ───────────────────────── Misiones de campo ─────────────────────────

const MAX_TEXTO = 800;

export function validarCampos(
  campos: Extract<Actividad, { tipo: 'mision' }>['campos'],
  entrada: Record<string, unknown>,
): Record<string, string | number> {
  const salida: Record<string, string | number> = {};
  for (const c of campos) {
    const v = entrada[c.id];
    const vacio = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
    switch (c.tipo) {
      case 'select':
        if (typeof v !== 'string' || !c.opciones!.includes(v)) throw new ErrorApi(400, 'campos_invalidos', { campo: c.id });
        salida[c.id] = v;
        break;
      case 'numero': {
        const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim()) : NaN;
        if (vacio || !Number.isInteger(n) || n < 0 || n > 10_000) throw new ErrorApi(400, 'campos_invalidos', { campo: c.id });
        salida[c.id] = n;
        break;
      }
      case 'texto':
      case 'textarea':
        if (vacio) break;
        if (typeof v !== 'string' || v.trim().length > MAX_TEXTO) throw new ErrorApi(400, 'campos_invalidos', { campo: c.id });
        salida[c.id] = v.trim();
        break;
    }
  }
  if (Object.keys(salida).length === 0) throw new ErrorApi(400, 'campos_invalidos');
  return salida;
}

export async function enviarEvidencia(ctx: Ctx, misionId: string, entrada: Record<string, unknown>) {
  const { actividad, modulo } = acceso(ctx, misionId);
  if (actividad.tipo !== 'mision') throw new ErrorApi(400, 'tipo_invalido');
  const campos = validarCampos(actividad.campos, entrada);
  const uid = ctx.usuario.uid;

  return ctx.almacen.transaccion(async (l) => {
    const p = await l.progreso(uid, misionId);
    if (p?.estado === 'completada') throw new ErrorApi(409, 'ya_aprobada');
    const ultima = (await l.evidencias(uid, misionId))[0];
    if (ultima?.estado === 'pendiente') throw new ErrorApi(409, 'ya_enviada');
    if (ultima?.estado === 'aprobada') throw new ErrorApi(409, 'ya_aprobada');

    const doc: EvidenciaDoc = {
      uid,
      codigo: ctx.usuario.codigo ?? '',
      aulaId: ctx.aula.id,
      equipo: ctx.usuario.equipo,
      misionId,
      campos,
      estado: 'pendiente',
      comentario: null,
      validadoPor: null,
      validadoEn: null,
      creado: ts(ctx),
    };
    return {
      resultado: { estado: 'pendiente' as const },
      escrituras: [
        { tipo: 'evidencia', doc },
        escrituraProgreso(ctx, misionId, { estado: 'en_curso', xp: 0, respuestas: {}, completadaEn: null, enviada: true }, 0),
        evento(ctx, 'evidencia_enviada', { modulo: modulo.id, actividadId: misionId }),
      ],
    };
  });
}

export async function misEvidencias(ctx: Ctx) {
  const misiones = modulosDelBrazo(ctx.brazo)
    .flatMap((m) => m.items)
    .filter((a) => a.tipo === 'mision');
  const l = ctx.almacen.lector();
  const listas = await Promise.all(misiones.map((m) => l.evidencias(ctx.usuario.uid, m.id)));
  return listas.flat().map((e) => ({
    id: e.id,
    misionId: e.misionId,
    estado: e.estado,
    comentario: e.estado === 'devuelta' ? e.comentario : null,
    creado: e.creado.toDate().toISOString(),
  }));
}

// ───────────────────────── Ranking ─────────────────────────

export async function ranking(ctx: Ctx) {
  if (!esExp(ctx)) throw new ErrorApi(403, 'solo_experimental');
  const estudiantes = await ctx.almacen.lector().estudiantesAula(ctx.aula.id);
  return { equipos: rankingEquipos(estudiantes), miEquipo: ctx.usuario.equipo };
}

// ───────────────────────── Eventos del navegador ─────────────────────────

export async function registrarEventoCliente(
  ctx: Ctx,
  tipo: 'ver_modulo' | 'ver_item' | 'abrir_enlace' | 'abrir_evaluacion',
  moduloId?: string,
  actividadId?: string,
) {
  let modulo = moduloId;
  if (actividadId) modulo = acceso(ctx, actividadId).modulo.id;
  else if (moduloId) moduloDelBrazo(ctx, moduloId);
  else throw new ErrorApi(400, 'entrada_invalida');
  await ctx.almacen.transaccion(async () => ({
    resultado: null,
    escrituras: [evento(ctx, tipo, { ...(modulo ? { modulo } : {}), ...(actividadId ? { actividadId } : {}) })],
  }));
  return {};
}
