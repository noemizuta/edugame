/**
 * Reglas puras del juego y del calendario del estudio.
 * Sin acceso a datos ni a la red: todo recibe sus entradas por parámetro.
 * Ver docs/ESPECIFICACION.md, secciones 5, 6, 8 y 9, y la decisión 7 de
 * docs/DECISIONES.md: el estudio dura 1 semana y se cuenta por DÍAS.
 */

export type Brazo = 'experimental' | 'control';
export const ROLES = ['estudiante', 'promotor', 'investigador', 'admin'] as const;
export type Rol = (typeof ROLES)[number];
/** Personal del estudio: no pasa por consentimiento ni se une a un aula (decisión 6). */
export const esPersonal = (rol: Rol): boolean => rol !== 'estudiante';
export const EQUIPOS = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'] as const;
export type Equipo = (typeof EQUIPOS)[number];

/** Alfabeto sin 0/O ni 1/I (códigos de aula y de participante). */
export const ALFABETO_CODIGOS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const DIA_MS = 86_400_000;
/** America/Lima: UTC−5 fijo, sin horario de verano. */
const OFFSET_LIMA_MS = -5 * 60 * 60 * 1000;

// ───────────────────────── Fechas (siempre en Lima) ─────────────────────────

/** Fecha local de Lima en formato AAAA-MM-DD. */
export function fechaLima(ahora: Date): string {
  return new Date(ahora.getTime() + OFFSET_LIMA_MS).toISOString().slice(0, 10);
}

/** Hora local de Lima «AAAA-MM-DD HH:mm:ss» (para los CSV). */
export function fechaHoraLima(instante: Date): string {
  return new Date(instante.getTime() + OFFSET_LIMA_MS).toISOString().slice(0, 19).replace('T', ' ');
}

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function esFechaIso(f: string): boolean {
  const m = RE_FECHA.exec(f);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return d.toISOString().slice(0, 10) === f;
}

function diaUtc(f: string): number {
  const m = RE_FECHA.exec(f);
  if (!m) throw new Error(`Fecha inválida: ${f}`);
  return Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!);
}

/** Días de calendario de `desde` a `hasta` (AAAA-MM-DD). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((diaUtc(hasta) - diaUtc(desde)) / DIA_MS);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date(diaUtc(fecha) + dias * DIA_MS).toISOString().slice(0, 10);
}

/** ¿La fecha AAAA-MM-DD cae en lunes? */
export function esLunes(fecha: string): boolean {
  return new Date(diaUtc(fecha)).getUTCDay() === 1;
}

/**
 * Día del estudio del aula (decisión 7): el día de `fechaInicio` es el día 1,
 * contado con la fecha de Lima. Antes del inicio es 0 o negativo.
 */
export function diaEstudio(fechaInicio: string, ahora: Date): number {
  return diasEntre(fechaInicio, fechaLima(ahora)) + 1;
}

/** Fecha (AAAA-MM-DD) del día N del estudio del aula. */
export function fechaApertura(fechaInicio: string, dia: number): string {
  return sumarDias(fechaInicio, dia - 1);
}

/** Fecha corta es-PE: «12 abr.». */
export function fechaCorta(fecha: string): string {
  return new Date(diaUtc(fecha)).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export interface Fase {
  desde: number;
  hasta: number;
  texto: string;
}

/** Texto de fase, p. ej. «Día 3 de 7». */
export function textoFase(dia: number, fases: readonly Fase[]): string {
  const f = fases.find((x) => dia >= x.desde && dia <= x.hasta);
  return f ? f.texto.replace('{n}', String(dia)) : '';
}

// ───────────────────────── Apertura y brazos ─────────────────────────

/** Algo que se abre en un día del estudio (`dia`, desde 1). */
export interface ConDia {
  dia: number;
  brazos?: readonly Brazo[];
}

export const estaAbierto = (item: ConDia, dia: number): boolean => dia >= item.dia;

export const esParaBrazo = (item: { brazos?: readonly Brazo[] }, brazo: Brazo): boolean =>
  !item.brazos || item.brazos.includes(brazo);

// ───────────────────────── Niveles ─────────────────────────

export interface NivelCfg {
  nombre: string;
  xp: number;
}

export interface InfoNivel {
  indice: number;
  nombre: string;
  xpNivel: number;
  siguiente: NivelCfg | null;
  /** XP que faltan para el siguiente nivel (0 en el máximo). */
  faltan: number;
  /** Progreso dentro del nivel, de 0 a 1. */
  progreso: number;
}

export function nivel(xp: number, niveles: readonly NivelCfg[]): InfoNivel {
  const orden = [...niveles].sort((a, b) => a.xp - b.xp);
  const x = Math.max(0, xp);
  let i = 0;
  orden.forEach((n, k) => {
    if (x >= n.xp) i = k;
  });
  const actual = orden[i]!;
  const siguiente = orden[i + 1] ?? null;
  const progreso = siguiente ? (x - actual.xp) / (siguiente.xp - actual.xp) : 1;
  return {
    indice: i,
    nombre: actual.nombre,
    xpNivel: actual.xp,
    siguiente,
    faltan: siguiente ? siguiente.xp - x : 0,
    progreso: Math.max(0, Math.min(1, progreso)),
  };
}

// ───────────────────────── Racha ─────────────────────────

/**
 * Racha (decisión 7): días seguidos en los que se completó al menos un reto,
 * contados hacia atrás desde hoy (si hoy aún no hay reto, desde ayer). Mínimo día 1.
 */
export function racha(diasConReto: readonly number[], dia: number): number {
  const dias = new Set(diasConReto);
  let d = dias.has(dia) ? dia : dia - 1;
  let n = 0;
  while (d >= 1 && dias.has(d)) {
    n++;
    d--;
  }
  return n;
}

/** ID del reto según su número original en retos.json (5–16). */
export const idReto = (n: number): string => `reto-s${n}`;
export const idCasoReto = (n: number): string => `caso-s${n}`;

// ───────────────────────── Insignias ─────────────────────────

/** Resumen del progreso de una actividad, lo mínimo que usan las reglas. */
export interface ProgresoResumen {
  estado: 'en_curso' | 'completada';
  puntaje?: number;
  max?: number;
  responsable?: boolean;
}

export interface EntradaInsignias {
  progreso: Readonly<Record<string, ProgresoResumen | undefined>>;
  xp: number;
  racha: number;
}

export interface InsigniaCfg {
  id: string;
  icono: string;
  nombre: string;
  como: string;
  regla: string;
}

export type Regla = (e: EntradaInsignias) => boolean;

const completadaEn = (e: EntradaInsignias, id: string) => e.progreso[id]?.estado === 'completada';

/**
 * Interpreta las reglas de `config-juego.json → insignias[].regla`.
 * Formas admitidas (las del archivo actual):
 *  - «<id> completada …»
 *  - «<id>.puntaje / <id>.max >= <n>»
 *  - «al menos <n> actividades <prefijo>* con responsable = true»
 *  - «racha >= <n>» · «xp >= <n>»
 * Devuelve `null` si la regla no se reconoce (una prueba lo impide).
 */
export function interpretarRegla(regla: string): Regla | null {
  const r = regla.trim();
  let m: RegExpExecArray | null;

  if ((m = /^([a-z0-9-]+)\.puntaje\s*\/\s*\1\.max\s*>=\s*([\d.]+)$/i.exec(r))) {
    const id = m[1]!;
    const umbral = Number(m[2]);
    return (e) => {
      const p = e.progreso[id];
      return !!p && p.estado === 'completada' && !!p.max && (p.puntaje ?? 0) / p.max >= umbral;
    };
  }
  if ((m = /^al menos (\d+) actividades ([a-z0-9-]+)\*\s+con responsable = true$/i.exec(r))) {
    const n = Number(m[1]);
    const prefijo = m[2]!;
    return (e) =>
      Object.entries(e.progreso).filter(([id, p]) => id.startsWith(prefijo) && p?.responsable === true).length >= n;
  }
  if ((m = /^(racha|xp)\s*>=\s*(\d+)$/i.exec(r))) {
    const campo = m[1]!.toLowerCase() as 'racha' | 'xp';
    const n = Number(m[2]);
    return (e) => e[campo] >= n;
  }
  if ((m = /^([a-z0-9-]+) completada\b/i.exec(r))) {
    const id = m[1]!;
    return (e) => completadaEn(e, id);
  }
  return null;
}

export interface InsigniaEstado extends Omit<InsigniaCfg, 'regla'> {
  ganada: boolean;
}

/** Insignias calculadas desde el progreso (no se guardan). */
export function insignias(cfg: readonly InsigniaCfg[], entrada: EntradaInsignias): InsigniaEstado[] {
  return cfg.map(({ regla, ...resto }) => {
    const f = interpretarRegla(regla);
    return { ...resto, ganada: f ? f(entrada) : false };
  });
}

// ───────────────────────── Ranking por equipos ─────────────────────────

export interface ParticipanteRanking {
  rol: Rol;
  brazo: Brazo | null;
  equipo: Equipo | null;
  xp: number;
  retirado: boolean;
}

export interface FilaRanking {
  equipo: Equipo;
  promedio: number;
  integrantes: number;
}

/**
 * Promedio de XP por equipo, solo con estudiantes experimentales no
 * retirados. Nunca hay ranking individual. Empate: el equipo de número menor.
 */
export function rankingEquipos(participantes: readonly ParticipanteRanking[]): FilaRanking[] {
  const grupos = new Map<Equipo, number[]>();
  for (const p of participantes) {
    if (p.rol !== 'estudiante' || p.brazo !== 'experimental' || !p.equipo || p.retirado) continue;
    const xs = grupos.get(p.equipo) ?? [];
    xs.push(Math.max(0, p.xp || 0));
    grupos.set(p.equipo, xs);
  }
  return [...grupos.entries()]
    .map(([equipo, xs]) => ({
      equipo,
      promedio: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length),
      integrantes: xs.length,
    }))
    .sort((a, b) => b.promedio - a.promedio || a.equipo.localeCompare(b.equipo, 'en', { numeric: true }));
}

/** Equipo con menos integrantes; empate → el número menor (5.2, paso 6). */
export function equipoConMenos(conteo: Partial<Record<Equipo, number>>): Equipo {
  let mejor: Equipo = EQUIPOS[0];
  for (const e of EQUIPOS) {
    if ((conteo[e] ?? 0) < (conteo[mejor] ?? 0)) mejor = e;
  }
  return mejor;
}

// ───────────────────────── Semáforo ─────────────────────────

export type ColorSemaforo = 'verde' | 'amarillo' | 'rojo';

export interface Semaforo {
  color: ColorSemaforo;
  dias: number | null;
  texto: string;
}

/** 🟢 hasta 7 días · 🟡 de 8 a 14 · 🔴 más de 14 o nunca (días de calendario en Lima). */
export function semaforo(
  ultimoAcceso: Date | null,
  ahora: Date,
  cfg: { verdeHastaDias: number; amarilloHastaDias: number },
): Semaforo {
  if (!ultimoAcceso) return { color: 'rojo', dias: null, texto: 'Nunca ingresó' };
  const dias = Math.max(0, diasEntre(fechaLima(ultimoAcceso), fechaLima(ahora)));
  if (dias <= cfg.verdeHastaDias) return { color: 'verde', dias, texto: dias === 0 ? 'Hoy' : `Hace ${dias} d` };
  return { color: dias <= cfg.amarilloHastaDias ? 'amarillo' : 'rojo', dias, texto: `${dias} d sin entrar` };
}

// ───────────────────────── Barajado estable ─────────────────────────

/** Hash de 32 bits (cyrb53 recortado), estable entre plataformas. */
export function hashCadena(s: string): number {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** PRNG mulberry32: devuelve números en [0, 1). */
export function prng(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Permutación estable de 0…n−1 para una semilla de texto (p. ej. uid + id de
 * la actividad). `perm[posicionMostrada] = indiceOriginal`.
 */
export function permutacion(n: number, semilla: string): number[] {
  const rnd = prng(hashCadena(semilla));
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  return p;
}

export function barajar<T>(items: readonly T[], semilla: string): T[] {
  return permutacion(items.length, semilla).map((i) => items[i]!);
}

export const semillaBarajado = (uid: string, ...partes: string[]): string => [uid, ...partes].join('|');

// ───────────────────────── XP ─────────────────────────

/** Máximo 60 XP por acción y nunca negativo. */
export function topeXp(xp: number, maxPorAccion = 60): number {
  if (!Number.isFinite(xp)) return 0;
  return Math.max(0, Math.min(maxPorAccion, Math.round(xp)));
}

/** Misión 1: round(aciertos / total × xpMaximo). */
export function xpQuiz(aciertos: number, total: number, xpMaximo: number): number {
  if (total <= 0) return 0;
  const a = Math.max(0, Math.min(total, aciertos));
  return Math.round((a / total) * xpMaximo);
}

/** Reto: xpPorAcierto × aciertos, + bono de racha si el reto anterior está completo. */
export function xpReto(aciertos: number, retoAnteriorCompleto: boolean, xpPorAcierto: number, bonoRacha: number): number {
  return Math.max(0, aciertos) * xpPorAcierto + (retoAnteriorCompleto ? bonoRacha : 0);
}

// ───────────────────────── Estado de módulos y siguiente misión ─────────────────────────

export interface ItemMin extends ConDia {
  id: string;
  tipo: string;
}

export interface ModuloMin extends ConDia {
  id: string;
  items: readonly ItemMin[];
}

export type EstadoModulo =
  | { tipo: 'cerrado'; abre: string; texto: string }
  | { tipo: 'proxima'; fecha: string; texto: string }
  | { tipo: 'pendientes'; n: number; texto: string }
  | { tipo: 'al_dia'; texto: string }
  /** Abierto y solo con enlaces (no tienen «completado»), p. ej. Chat. */
  | { tipo: 'abierto'; texto: string };

/** Tipos que no cuentan como pendientes ni para la siguiente misión. */
const TIPOS_SIN_PENDIENTE = new Set(['enlace']);

/** Por defecto cuenta todo menos los enlaces (no tienen «completado»). */
const cuentaPorDefecto = (i: ItemMin) => !TIPOS_SIN_PENDIENTE.has(i.tipo);

export function itemsDelBrazo<T extends ItemMin>(items: readonly T[], brazo: Brazo): T[] {
  return items.filter((i) => esParaBrazo(i, brazo));
}

/**
 * Estado de un módulo en Inicio (sección 6). `items` debe venir ya filtrado
 * por brazo.
 */
export function estadoModulo(
  modulo: ModuloMin,
  dia: number,
  fechaInicio: string,
  completada: (actividadId: string) => boolean,
  /** ¿La actividad cuenta como pendiente? (p. ej. no un podcast sin enlace). */
  cuenta: (item: ItemMin) => boolean = cuentaPorDefecto,
): EstadoModulo {
  if (!estaAbierto(modulo, dia)) {
    const abre = fechaApertura(fechaInicio, modulo.dia);
    return { tipo: 'cerrado', abre, texto: `Se abre el ${fechaCorta(abre)}` };
  }
  const abiertos = modulo.items.filter((i) => estaAbierto(i, dia));
  const proximas = modulo.items.map((i) => i.dia).filter((d) => d > dia);
  const proxima = (): EstadoModulo => {
    const fecha = fechaApertura(fechaInicio, Math.min(...proximas));
    return { tipo: 'proxima', fecha, texto: `Próxima: ${fechaCorta(fecha)}` };
  };
  if (abiertos.length === 0) return proximas.length ? proxima() : { tipo: 'al_dia', texto: 'Al día ✓' };
  const contables = abiertos.filter(cuenta);
  if (contables.length === 0) return { tipo: 'abierto', texto: 'Abrir' };
  const n = contables.filter((i) => !completada(i.id)).length;
  // Todo lo abierto está hecho: si aún se abrirá algo, se muestra cuándo.
  if (n === 0) return proximas.length ? proxima() : { tipo: 'al_dia', texto: 'Al día ✓' };
  return { tipo: 'pendientes', n, texto: n === 1 ? '1 pendiente' : `${n} pendientes` };
}

export type MisionSemana =
  | { tipo: 'antes_inicio' }
  | { tipo: 'al_dia' }
  | { tipo: 'actividad'; moduloId: string; actividadId: string };

/**
 * Siguiente misión (experimental) o siguiente tema (control): la primera
 * actividad abierta y no completada, en el orden de modulos.json, sin contar
 * las de tipo `enlace`. `modulos` debe venir filtrado por brazo.
 */
export function misionDeLaSemana(
  modulos: readonly ModuloMin[],
  dia: number,
  completada: (actividadId: string) => boolean,
  cuenta: (item: ItemMin) => boolean = cuentaPorDefecto,
): MisionSemana {
  if (dia < 1) return { tipo: 'antes_inicio' };
  for (const m of modulos) {
    if (!estaAbierto(m, dia)) continue;
    for (const i of m.items) {
      if (!cuenta(i) || !estaAbierto(i, dia) || completada(i.id)) continue;
      return { tipo: 'actividad', moduloId: m.id, actividadId: i.id };
    }
  }
  return { tipo: 'al_dia' };
}

// ───────────────────────── Códigos y textos ─────────────────────────

const RE_CODIGO_AULA = new RegExp(`^[${ALFABETO_CODIGOS}]{6}$`);
const RE_CODIGO_PARTICIPANTE = new RegExp(`^G-[${ALFABETO_CODIGOS}]{5}$`);

/** Mayúsculas y sin espacios (código de aula). */
export const normalizarCodigoAula = (s: string): string => s.replace(/\s+/g, '').toUpperCase();
export const esCodigoAula = (s: string): boolean => RE_CODIGO_AULA.test(s);

/** Mayúsculas y sin espacios (código de asistencia, antes de calcular su hash). */
export const normalizarCodigoAsistencia = (s: string): string => s.replace(/\s+/g, '').toUpperCase();

export const normalizarCodigoParticipante = (s: string): string => {
  const c = s.replace(/\s+/g, '').toUpperCase();
  return c.startsWith('G-') ? c : /^[A-Z0-9]{5}$/.test(c) ? `G-${c}` : c;
};
export const esCodigoParticipante = (s: string): boolean => RE_CODIGO_PARTICIPANTE.test(s);

/** Cadena aleatoria del alfabeto de códigos. `rnd` devuelve [0, 1). */
export function generarCadena(n: number, rnd: () => number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += ALFABETO_CODIGOS[Math.floor(rnd() * ALFABETO_CODIGOS.length)];
  return s;
}

export const generarCodigoAula = (rnd: () => number): string => generarCadena(6, rnd);
export const generarCodigoParticipante = (rnd: () => number): string => `G-${generarCadena(5, rnd)}`;

/** Quita la frase inicial de juego «¡…!» de una retroalimentación (para el control). */
export function quitarExclamacionInicial(texto: string): string {
  const sin = texto.replace(/^\s*¡[^!¡]*!\s*/u, '');
  return sin.length > 0 ? sin.charAt(0).toUpperCase() + sin.slice(1) : texto;
}

/** Reemplaza {codigo} en plantillas de mensajes. */
export const aplicarCodigo = (plantilla: string, codigo: string): string => plantilla.replaceAll('{codigo}', codigo);

/** Reemplaza {codigo} en un enlace (codificado para URL), p. ej. Google Forms prellenado. */
export const enlaceConCodigo = (url: string, codigo: string): string =>
  url.replaceAll('{codigo}', encodeURIComponent(codigo));

export interface TramoResultado {
  desde: number;
  hasta: number;
  texto: string;
}

/** Texto de resultado de la Misión 1 según el porcentaje de aciertos. */
export function textoResultado(aciertos: number, total: number, tramos: readonly TramoResultado[]): string {
  const pct = total > 0 ? Math.round((aciertos / total) * 100) : 0;
  return tramos.find((t) => pct >= t.desde && pct <= t.hasta)?.texto ?? '';
}

// ───────────────────────── Dosis (H3) ─────────────────────────

const TIPOS_ACTIVOS = new Set(['respuesta', 'completar', 'evidencia_enviada']);

/** ¿Este evento cuenta para los días activos (dosis, H3)? Solo los días 1…`hasta` del estudio. */
export const esEventoActivo = (tipo: string, dia: number | null, hasta = 7): dia is number =>
  dia != null && TIPOS_ACTIVOS.has(tipo) && dia >= 1 && dia <= hasta;

/** Días distintos del estudio (1…`hasta`) con al menos un evento respuesta, completar o evidencia_enviada. */
export function diasActivos(eventos: readonly { tipo: string; dia: number | null }[], hasta = 7): number {
  const s = new Set<number>();
  for (const e of eventos) if (esEventoActivo(e.tipo, e.dia, hasta)) s.add(e.dia);
  return s.size;
}

// ───────────────────────── Flujo de ingreso (sección 5.1 y decisión 6) ─────────────────────────

export type Paso =
  | '/consentimiento'
  | '/unirse'
  | '/bienvenida-aula'
  | '/inicio'
  | '/panel'
  | '/seguimiento'
  | '/admin';

export const PANEL_DEL_ROL: Record<Exclude<Rol, 'estudiante'>, Paso> = {
  admin: '/admin',
  investigador: '/seguimiento',
  promotor: '/panel',
};

/** Siguiente pantalla que le corresponde a un usuario. El personal va directo a su panel. */
export function siguientePaso(u: {
  rol: Rol;
  consentimiento: unknown;
  aulaId: string | null;
  avatar: string | null;
}): Paso {
  if (u.rol !== 'estudiante') return PANEL_DEL_ROL[u.rol];
  if (!u.consentimiento) return '/consentimiento';
  if (!u.aulaId) return '/unirse';
  if (!u.avatar) return '/bienvenida-aula';
  return '/inicio';
}

// ───────────────────────── Límite de intentos ─────────────────────────

export const HORA_MS = 3_600_000;

export interface VentanaIntentos {
  /** Inicio de la ventana, en milisegundos. */
  desde: number;
  intentos: number;
}

/** ¿Ya se agotaron los intentos de esta ventana? (10 por hora en unirse y en asistencia). */
export function limiteAgotado(v: VentanaIntentos | undefined, ahora: number, max = 10, ventanaMs = HORA_MS): boolean {
  return !!v && ahora - v.desde < ventanaMs && v.intentos >= max;
}

/** Registra un intento fallido (ventana fija que se reinicia al vencer). */
export function sumarFallo(v: VentanaIntentos | undefined, ahora: number, ventanaMs = HORA_MS): VentanaIntentos {
  if (!v || ahora - v.desde >= ventanaMs) return { desde: ahora, intentos: 1 };
  return { desde: v.desde, intentos: v.intentos + 1 };
}
