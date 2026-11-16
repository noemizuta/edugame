/**
 * Contenidos del estudio (content/*.json): esquemas zod, carga, validación y
 * catálogo. SOLO SERVIDOR: aquí viven las respuestas correctas y la
 * retroalimentación, que nunca se envían al navegador antes de responder.
 */
import 'server-only';
import modulosJson from '@/content/modulos.json';
import retosJson from '@/content/retos.json';
import mision1Json from '@/content/mision1.json';
import configJson from '@/content/config-juego.json';
import calendarioJson from '@/content/calendario.json';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { type Brazo, esParaBrazo, idCasoReto, idReto } from './juego';

// ───────────────────────── Piezas comunes ─────────────────────────

const Brazo = z.enum(['experimental', 'control']);
const Semana = z.number().int().min(0).max(18);
/** Los ID se usan como ID de documento de Firestore: sin puntos ni barras. */
const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ID inválido: solo minúsculas, números y guiones (sin puntos)');
const Texto = z.string().trim().min(1);

const base = { id: Id, semana: Semana, brazos: z.array(Brazo).min(1).optional(), titulo: Texto };

export const OpcionCaso = z.strictObject({ texto: Texto, responsable: z.boolean(), feedback: Texto });

const opcionesCaso = z
  .array(OpcionCaso)
  .min(2)
  .refine((ops) => ops.filter((o) => o.responsable).length === 1, 'Un caso debe tener exactamente una opción responsable');

// ───────────────────────── Actividades de modulos.json ─────────────────────────

const Lectura = z.strictObject({ ...base, tipo: z.literal('lectura'), html: Texto });
const Quiz = z.strictObject({
  ...base,
  tipo: z.literal('quiz'),
  xp: z.number().int().positive(),
  fuente: z.literal('mision1.json'),
  resumen: Texto,
});
const Caso = z.strictObject({ ...base, tipo: z.literal('caso'), texto: Texto, opciones: opcionesCaso });
const Audio = z.strictObject({ ...base, tipo: z.literal('audio'), enlace: z.string() });

export const CampoMision = z
  .strictObject({
    id: Id.or(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/)),
    etiqueta: Texto,
    tipo: z.enum(['select', 'numero', 'texto', 'textarea']),
    opciones: z.array(Texto).min(1).optional(),
  })
  .refine((c) => (c.tipo === 'select') === !!c.opciones, 'Solo los campos «select» llevan opciones, y siempre');

const Mision = z.strictObject({
  ...base,
  tipo: z.literal('mision'),
  xp: z.number().int().positive(),
  instrucciones: Texto,
  campos: z.array(CampoMision).min(1, 'Una misión debe tener campos'),
});

export const ENLACES_ESTUDIO = ['o1', 'o2', 'satisfaccion', 'o3'] as const;
const EnlaceConfigEstudio = z.enum([
  'estudio.enlaces.o1',
  'estudio.enlaces.o2',
  'estudio.enlaces.satisfaccion',
  'estudio.enlaces.o3',
]);
const Encuentro = z.strictObject({
  ...base,
  tipo: z.literal('encuentro'),
  enlaceConfig: z.string().regex(/^aula\.encuentros\.enc-[1-3]\.enlace$/),
});
const Enlace = z.strictObject({ ...base, tipo: z.literal('enlace'), enlaceConfig: z.literal('aula.enlaceGrupo') });
const Evaluacion = z.strictObject({ ...base, tipo: z.literal('evaluacion'), enlaceConfig: EnlaceConfigEstudio });

const ItemModulo = z.discriminatedUnion('tipo', [Lectura, Quiz, Caso, Audio, Mision, Encuentro, Enlace, Evaluacion]);

const ModuloJson = z.strictObject({
  id: Id,
  pantalla: z.string(),
  grupo: z.enum(['Aprender', 'Jugar y actuar', 'Conectar', 'Mi progreso']),
  color: z.enum(['amarillo', 'cian']),
  icono: Texto,
  semana: Semana,
  brazos: z.array(Brazo).min(1).optional(),
  titulo: Texto,
  tituloControl: Texto.optional(),
  descripcion: Texto,
  /** Decisión 1: si falta, el control no ve la descripción del módulo. */
  descripcionControl: Texto.optional(),
  items: z.array(ItemModulo),
  _retos: z.literal('retos.json').optional(),
});

export const ModulosJson = z.strictObject({ _nota: z.string().optional(), modulos: z.array(ModuloJson).min(1) });

// ───────────────────────── retos.json ─────────────────────────

export const PreguntaReto = z
  .strictObject({
    texto: Texto,
    opciones: z.array(Texto).min(2),
    correcta: z.number().int().min(0),
    explicacion: Texto,
  })
  .refine((p) => p.correcta < p.opciones.length, 'La opción «correcta» está fuera de rango');

export const RetosJson = z.strictObject({
  _nota: z.string().optional(),
  retos: z
    .array(
      z.strictObject({
        semana: Semana,
        tema: Texto,
        preguntas: z.array(PreguntaReto).length(3, 'Un reto debe tener exactamente 3 preguntas'),
        caso: z.strictObject({ texto: Texto, opciones: opcionesCaso }),
      }),
    )
    .min(1),
});

// ───────────────────────── mision1.json ─────────────────────────

export const CasoMision1 = z.strictObject({
  id: Id,
  titulo: Texto,
  escena: Texto,
  pregunta: Texto,
  opciones: z
    .array(z.strictObject({ texto: Texto, correcta: z.boolean(), feedback: Texto }))
    .min(2)
    .refine((ops) => ops.filter((o) => o.correcta).length === 1, 'Un caso de la Misión 1 debe tener exactamente una opción correcta'),
});

const Tramo = z.strictObject({ desde: z.number(), hasta: z.number(), texto: Texto });

export const Mision1Json = z.strictObject({
  _nota: z.string().optional(),
  id: z.literal('mision1'),
  titulo: Texto,
  xpMaximo: z.number().int().positive(),
  umbralInsignia: z.number().min(0).max(1),
  intro: z.strictObject({ titulo: Texto, parrafos: z.array(Texto).min(1), boton: Texto, imagen: z.string().startsWith('/') }),
  resultadoFinal: z.array(Tramo).min(1),
  casos: z.array(CasoMision1).min(1),
});

// ───────────────────────── config-juego.json ─────────────────────────

export const ConfigJuego = z.strictObject({
  _nota: z.string().optional(),
  app: z.strictObject({
    nombre: Texto,
    titulo: Texto,
    lema: Texto,
    institucion: Texto,
    tituloControl: Texto,
    zonaHoraria: z.literal('America/Lima'),
    semanaFinal: z.number().int().min(0).max(18),
    capacidadAula: z.number().int().positive(),
    tamanoEquipo: z.number().int().positive(),
  }),
  niveles: z.array(z.strictObject({ nombre: Texto, xp: z.number().int().min(0) })).min(1),
  xp: z.strictObject({
    retoCorrecta: z.number().int().min(0),
    casoResponsable: z.number().int().min(0),
    rachaSemana: z.number().int().min(0),
    podcast: z.number().int().min(0),
    encuentro: z.number().int().min(0),
    evaluacion: z.number().int().min(0),
    maxPorAccion: z.number().int().positive(),
  }),
  insignias: z.array(z.strictObject({ id: Id, icono: Texto, nombre: Texto, como: Texto, regla: Texto })).min(1),
  avatares: z.array(Texto).length(8),
  consentimiento: z.strictObject({ version: Texto, texto: Texto, casilla: Texto }),
  derivacion: Texto,
  reenganche: z.strictObject({ amarillo: Texto, rojo: Texto }),
  semaforo: z.strictObject({ verdeHastaDias: z.number().int().min(0), amarilloHastaDias: z.number().int().min(0) }),
  fases: z.array(Tramo).min(1),
  nombresControl: z.strictObject({ grupos: z.record(z.string(), Texto), tarjetaSemana: Texto }),
});

// ───────────────────────── calendario.json (decisión 7) ─────────────────────────

export const CalendarioJson = z.strictObject({
  _nota: z.string().optional(),
  duracionDias: z.number().int().min(1).max(120),
  /** Día de apertura (1…duracionDias) de las actividades que no se abren el día 1. */
  aperturas: z.record(Id, z.number().int().min(1)),
  fases: z.array(Tramo).min(1),
  semaforo: z.strictObject({ verdeHastaDias: z.number().int().min(0), amarilloHastaDias: z.number().int().min(0) }),
  textos: z.strictObject({ tarjetaExperimental: Texto, tarjetaControl: Texto, alDia: Texto, antesDelInicio: Texto }),
  modulos: z
    .record(
      Id,
      z.strictObject({
        titulo: Texto.optional(),
        tituloControl: Texto.optional(),
        descripcion: Texto.optional(),
        descripcionControl: Texto.optional(),
      }),
    )
    .default({}),
  insignias: z
    .record(Id, z.strictObject({ icono: Texto.optional(), nombre: Texto.optional(), como: Texto.optional(), regla: Texto.optional() }))
    .default({}),
});
export type Calendario = z.infer<typeof CalendarioJson>;

// ───────────────────────── Tipos del catálogo ─────────────────────────

export type ConfigJuego = z.infer<typeof ConfigJuego>;
export type Mision1 = z.infer<typeof Mision1Json>;
export type PreguntaReto = z.infer<typeof PreguntaReto>;
type ItemJson = z.infer<typeof ItemModulo>;

/** Reto generado desde retos.json (id `reto-sN`; `semana` es la del kit original). */
export interface ActividadReto {
  id: string;
  tipo: 'reto';
  semana: number;
  brazos?: undefined;
  titulo: string;
  tema: string;
  preguntas: PreguntaReto[];
  /** Microcaso que va debajo del reto (`caso-sN`). */
  casoId: string;
}

/** Caso: de la Botica, o el microcaso de un reto (`caso-sN`, con `retoId`). */
export type ActividadCaso = Extract<ItemJson, { tipo: 'caso' }> & { retoId?: string };

type ActividadBase = Exclude<ItemJson, { tipo: 'caso' }> | ActividadCaso | ActividadReto;
/** Actividad con su `dia` de apertura según calendario.json. */
export type Actividad = ActividadBase & { dia: number };
export type TipoActividad = Actividad['tipo'];

export type Modulo = Omit<z.infer<typeof ModuloJson>, 'items' | '_retos'> & { items: Actividad[]; dia: number };

export interface Catalogo {
  config: ConfigJuego;
  calendario: Calendario;
  mision1: Mision1;
  modulos: Modulo[];
  /** Índice de actividades por ID, con su módulo. */
  actividades: Map<string, { actividad: Actividad; moduloId: string }>;
}

export interface FuentesContenido {
  modulos: unknown;
  retos: unknown;
  mision1: unknown;
  config: unknown;
  calendario: unknown;
}

export class ErrorContenido extends Error {
  constructor(public readonly problemas: string[]) {
    super(`Contenido inválido:\n- ${problemas.join('\n- ')}`);
    this.name = 'ErrorContenido';
  }
}

// ───────────────────────── HTML ─────────────────────────

export const ETIQUETAS_HTML = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'b', 'i'] as const;

/** Lista blanca: p, strong, em, ul, ol, li, b, i. Sin atributos. */
export function limpiarHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [...ETIQUETAS_HTML],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  });
}

// ───────────────────────── Construcción ─────────────────────────

function analizar<T>(nombre: string, esquema: z.ZodType<T>, datos: unknown, problemas: string[]): T | null {
  const r = esquema.safeParse(datos);
  if (r.success) return r.data;
  for (const i of r.error.issues) problemas.push(`${nombre} → ${i.path.join('.') || '(raíz)'}: ${i.message}`);
  return null;
}

/**
 * Valida los cuatro JSON, genera `reto-sN` y `caso-sN` dentro del módulo
 * `retos`, limpia el HTML y comprueba la coherencia entre archivos.
 * Lanza `ErrorContenido` con todos los problemas encontrados.
 */
export function construirCatalogo(fuentes: FuentesContenido): Catalogo {
  const problemas: string[] = [];
  const modulosJson = analizar('modulos.json', ModulosJson, fuentes.modulos, problemas);
  const retosJson = analizar('retos.json', RetosJson, fuentes.retos, problemas);
  const mision1 = analizar('mision1.json', Mision1Json, fuentes.mision1, problemas);
  const configOriginal = analizar('config-juego.json', ConfigJuego, fuentes.config, problemas);
  const calendario = analizar('calendario.json', CalendarioJson, fuentes.calendario, problemas);
  if (!modulosJson || !retosJson || !mision1 || !configOriginal || !calendario) throw new ErrorContenido(problemas);

  // calendario.json ajusta las reglas que dependían de las semanas (decisión 7).
  for (const id of Object.keys(calendario.insignias)) {
    if (!configOriginal.insignias.some((i) => i.id === id)) problemas.push(`calendario.json → insignias.${id}: no existe en config-juego.json`);
  }
  const config: ConfigJuego = {
    ...configOriginal,
    semaforo: calendario.semaforo,
    fases: calendario.fases,
    nombresControl: { ...configOriginal.nombresControl, tarjetaSemana: calendario.textos.tarjetaControl },
    insignias: configOriginal.insignias.map((i) => ({ ...i, ...calendario.insignias[i.id] })),
  };
  const diaDe = (id: string) => calendario.aperturas[id] ?? 1;

  // Retos: semanas únicas
  const semanasReto = retosJson.retos.map((r) => r.semana);
  for (const s of new Set(semanasReto)) {
    if (semanasReto.filter((x) => x === s).length > 1) problemas.push(`retos.json: la semana ${s} se repite`);
  }

  const itemsRetos: ActividadBase[] = [...retosJson.retos]
    .sort((a, b) => a.semana - b.semana)
    .flatMap((r, k): ActividadBase[] => [
      {
        id: idReto(r.semana),
        tipo: 'reto',
        semana: r.semana,
        titulo: `Reto ${k + 1} · ${r.tema}`,
        tema: r.tema,
        preguntas: r.preguntas,
        casoId: idCasoReto(r.semana),
      },
      {
        id: idCasoReto(r.semana),
        tipo: 'caso',
        semana: r.semana,
        titulo: `Reto ${k + 1} · Microcaso`,
        texto: r.caso.texto,
        opciones: r.caso.opciones,
        retoId: idReto(r.semana),
      },
    ]);

  const conRetos = modulosJson.modulos.filter((m) => m._retos);
  if (conRetos.length !== 1) problemas.push('modulos.json: debe haber exactamente un módulo con "_retos": "retos.json"');

  const modulos: Modulo[] = modulosJson.modulos.map(({ _retos, items, ...m }) => {
    if (_retos && items.length > 0) problemas.push(`modulos.json → ${m.id}: el módulo de retos debe tener "items": []`);
    const propios: ActividadBase[] = items.map((i) => (i.tipo === 'lectura' ? { ...i, html: limpiarHtml(i.html) } : i));
    const conDia: Actividad[] = (_retos ? itemsRetos : propios).map((a) => ({ ...a, dia: diaDe(a.id) }));
    const dia = conDia.length ? Math.min(...conDia.map((a) => a.dia)) : 1;
    return { ...m, ...calendario.modulos[m.id], items: conDia, dia };
  });
  for (const id of Object.keys(calendario.modulos)) {
    if (!modulos.some((m) => m.id === id)) problemas.push(`calendario.json → modulos.${id}: el módulo no existe`);
  }

  // Misión 1: retroalimentación con el mismo filtro de HTML que las lecturas
  const mision1Limpia: Mision1 = {
    ...mision1,
    casos: mision1.casos.map((c) => ({ ...c, opciones: c.opciones.map((o) => ({ ...o, feedback: limpiarHtml(o.feedback) })) })),
  };

  // ID únicos entre módulos, actividades y casos de la Misión 1
  const actividades = new Map<string, { actividad: Actividad; moduloId: string }>();
  const vistos = new Map<string, string>();
  const registrar = (id: string, donde: string) => {
    const previo = vistos.get(id);
    if (previo) problemas.push(`ID repetido «${id}» (${previo} y ${donde})`);
    else vistos.set(id, donde);
  };
  for (const m of modulos) {
    registrar(m.id, `módulo ${m.id}`);
    for (const a of m.items) {
      registrar(a.id, `actividad de ${m.id}`);
      actividades.set(a.id, { actividad: a, moduloId: m.id });
      if (a.brazos && m.brazos && !a.brazos.every((b) => m.brazos!.includes(b))) {
        problemas.push(`${a.id}: tiene un brazo que su módulo ${m.id} no muestra`);
      }
    }
  }
  for (const c of mision1Limpia.casos) registrar(c.id, 'caso de mision1.json');
  for (const [id, dia] of Object.entries(calendario.aperturas)) {
    if (!actividades.has(id)) problemas.push(`calendario.json → aperturas.${id}: la actividad no existe`);
    if (dia > calendario.duracionDias) problemas.push(`calendario.json → aperturas.${id}: el día ${dia} pasa de duracionDias`);
  }

  // Coherencia entre archivos
  const quizzes = modulos.flatMap((m) => m.items).filter((a) => a.tipo === 'quiz');
  if (quizzes.length !== 1 || quizzes[0]!.id !== mision1.id) {
    problemas.push('modulos.json: debe haber una sola actividad «quiz» con id «mision1»');
  } else if (quizzes[0]!.xp !== mision1.xpMaximo) {
    problemas.push('mision1: el xp de modulos.json no coincide con xpMaximo de mision1.json');
  }
  if (config.xp.maxPorAccion < Math.max(mision1.xpMaximo, ...modulos.flatMap((m) => m.items).map((a) => ('xp' in a ? a.xp : 0)))) {
    problemas.push('config-juego.json: maxPorAccion es menor que el XP de alguna actividad');
  }

  if (problemas.length > 0) throw new ErrorContenido(problemas);
  return { config, calendario, mision1: mision1Limpia, modulos, actividades };
}

// ───────────────────────── Acceso desde la app ─────────────────────────

let cache: Catalogo | null = null;

/** Catálogo validado (se construye una vez por proceso; falla al iniciar si hay errores). */
export function catalogo(): Catalogo {
  cache ??= construirCatalogo({
    modulos: modulosJson,
    retos: retosJson,
    mision1: mision1Json,
    config: configJson,
    calendario: calendarioJson,
  });
  return cache;
}

export const configJuego = (): ConfigJuego => catalogo().config;
export const calendario = (): Calendario => catalogo().calendario;
export const mision1 = (): Mision1 => catalogo().mision1;
export const modulo = (id: string): Modulo | undefined => catalogo().modulos.find((m) => m.id === id);
export const actividad = (id: string) => catalogo().actividades.get(id);

/** Módulos y actividades visibles para un brazo, en el orden de modulos.json. */
export function modulosDelBrazo(brazo: Brazo): Modulo[] {
  return catalogo()
    .modulos.filter((m) => esParaBrazo(m, brazo))
    .map((m) => ({ ...m, items: m.items.filter((a) => esParaBrazo(a, brazo)) }));
}
