/**
 * Panel del promotor (PP1–PP5). El promotor opera solo sobre sus aulas; el
 * admin, sobre todas; el investigador solo lee (decisión 6). SOLO SERVIDOR.
 */
import 'server-only';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Usuario } from '../api';
import { calendario, catalogo, configJuego } from '../contenido';
import { COLUMNAS_EVENTOS, COLUMNAS_PARTICIPANTES, aCsv } from '../csv';
import { ErrorApi } from '../errores';
import { db } from '../firebase-admin';
import {
  type Equipo,
  EQUIPOS,
  aplicarCodigo,
  fechaApertura,
  fechaCorta,
  fechaHoraLima,
  fechaLima,
  nivel,
  racha,
  semaforo,
  diaEstudio,
  textoFase,
  topeXp,
} from '../juego';
import {
  type AulaDoc,
  COL,
  type EncuentroDoc,
  type EventoDoc,
  type EvidenciaDoc,
  type ProgresoDoc,
  type UsuarioDoc,
} from '../modelo';
import { agregarEvento, nuevoEvento } from './eventos';
import { hashCodigoAsistencia } from './participante';

type Aula = AulaDoc & { id: string };

// ───────────────────────── Permisos ─────────────────────────

export function puedeVerAula(u: Usuario, aulaId: string): boolean {
  if (u.rol === 'admin' || u.rol === 'investigador') return true;
  return u.rol === 'promotor' && (u.aulasPromotor ?? []).includes(aulaId);
}

export function puedeEditarAula(u: Usuario, aulaId: string): boolean {
  if (u.rol === 'admin') return true;
  return u.rol === 'promotor' && (u.aulasPromotor ?? []).includes(aulaId);
}

async function aulaPermitida(u: Usuario, aulaId: string, editar = false): Promise<Aula> {
  if (!(editar ? puedeEditarAula(u, aulaId) : puedeVerAula(u, aulaId))) throw new ErrorApi(403, 'aula_no_permitida');
  const s = await db().collection(COL.aulas).doc(aulaId).get();
  if (!s.exists) throw new ErrorApi(404, 'aula_no_encontrada');
  return { ...(s.data() as AulaDoc), id: s.id };
}

const refUsuario = (uid: string) => db().collection(COL.usuarios).doc(uid);
const codigoPersonal = (u: Usuario) => u.codigo ?? u.uid;

// ───────────────────────── Aulas (PP1) ─────────────────────────

export function resumenAula(a: Aula, ahora: Date) {
  const dia = diaEstudio(a.fechaInicio, ahora);
  return {
    id: a.id,
    nombre: a.nombre,
    facultad: a.facultad,
    brazo: a.brazo,
    codigoUnion: a.codigoUnion,
    inscritos: a.inscritos,
    capacidad: a.capacidad,
    equipos: a.equipos,
    activa: a.activa,
    prueba: a.prueba,
    enlaceGrupo: a.enlaceGrupo,
    fechaInicio: a.fechaInicio,
    dia,
    duracionDias: calendario().duracionDias,
    fase: textoFase(dia, configJuego().fases),
  };
}

/** Aulas visibles: las propias (promotor) o todas (admin e investigador). */
export async function aulasDelPanel(u: Usuario, ahora: Date) {
  const f = db();
  let docs: FirebaseFirestore.DocumentSnapshot[];
  if (u.rol === 'promotor') {
    const ids = u.aulasPromotor ?? [];
    docs = ids.length ? await f.getAll(...ids.map((id) => f.collection(COL.aulas).doc(id))) : [];
  } else {
    docs = (await f.collection(COL.aulas).orderBy('nombre').get()).docs;
  }
  return docs.filter((d) => d.exists).map((d) => resumenAula({ ...(d.data() as AulaDoc), id: d.id }, ahora));
}

async function estudiantesDe(aulaId: string) {
  const r = await db().collection(COL.usuarios).where('aulaId', '==', aulaId).where('rol', '==', 'estudiante').get();
  return r.docs.map((d) => ({ ...(d.data() as UsuarioDoc), uid: d.id }));
}

/** Tabla de PP1: código, equipo, XP (experimental), días activos, último acceso y semáforo. */
export async function participantesAula(u: Usuario, aulaId: string, ahora: Date) {
  const aula = await aulaPermitida(u, aulaId);
  const cfg = configJuego();
  const exp = aula.brazo === 'experimental';
  const filas = (await estudiantesDe(aulaId))
    .map((e) => {
      const s = semaforo(e.ultimoAcceso?.toDate() ?? null, ahora, cfg.semaforo);
      const plantilla = s.color === 'amarillo' ? cfg.reenganche.amarillo : s.color === 'rojo' ? cfg.reenganche.rojo : null;
      return {
        uid: e.uid,
        codigo: e.codigo ?? '',
        equipo: exp ? e.equipo : null,
        xp: exp ? (e.xp ?? 0) : null,
        diasActivos: (e.diasActivos ?? []).length,
        ultimoAcceso: e.ultimoAcceso?.toDate().toISOString() ?? null,
        semaforo: s,
        mensaje: plantilla && e.codigo ? aplicarCodigo(plantilla, e.codigo) : null,
        retirado: e.retirado,
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const activos = filas.filter((f) => !f.retirado);
  return {
    aula: resumenAula(aula, ahora),
    umbrales: cfg.semaforo,
    contadores: {
      verde: activos.filter((f) => f.semaforo.color === 'verde').length,
      amarillo: activos.filter((f) => f.semaforo.color === 'amarillo').length,
      rojo: activos.filter((f) => f.semaforo.color === 'rojo').length,
    },
    participantes: filas,
  };
}

// ───────────────────────── Equipos (PP2) ─────────────────────────

export async function cambiarEquipo(u: Usuario, uid: string, equipo: Equipo, ahora: Date) {
  const max = configJuego().app.tamanoEquipo;
  return db().runTransaction(async (tx) => {
    const sU = await tx.get(refUsuario(uid));
    if (!sU.exists) throw new ErrorApi(404, 'usuario_no_encontrado');
    const e = sU.data() as UsuarioDoc;
    if (e.rol !== 'estudiante' || !e.aulaId) throw new ErrorApi(404, 'usuario_no_encontrado');
    if (!puedeEditarAula(u, e.aulaId)) throw new ErrorApi(403, 'aula_no_permitida');
    const refAula = db().collection(COL.aulas).doc(e.aulaId);
    const aula = (await tx.get(refAula)).data() as AulaDoc;
    if (aula.brazo !== 'experimental') throw new ErrorApi(400, 'solo_experimental');
    if (e.equipo === equipo) return { equipo, equipos: aula.equipos };
    if ((aula.equipos[equipo] ?? 0) >= max) throw new ErrorApi(409, 'equipo_lleno', { max });

    tx.update(refUsuario(uid), { equipo });
    tx.update(refAula, {
      [`equipos.${equipo}`]: FieldValue.increment(1),
      ...(e.equipo ? { [`equipos.${e.equipo}`]: FieldValue.increment(-1) } : {}),
    });
    agregarEvento(
      tx,
      nuevoEvento(uid, { ...e, equipo }, aula, 'equipo_cambiado', ahora, {
        detalle: `${e.equipo ?? '—'} → ${equipo} · por ${codigoPersonal(u)}`,
      }),
    );
    const equipos = { ...aula.equipos, [equipo]: (aula.equipos[equipo] ?? 0) + 1 } as Record<Equipo, number>;
    if (e.equipo) equipos[e.equipo] = Math.max(0, (equipos[e.equipo] ?? 0) - 1);
    return { equipo, equipos };
  });
}

// ───────────────────────── Evidencias (PP3) ─────────────────────────

function misionDe(id: string) {
  const a = catalogo().actividades.get(id)?.actividad;
  if (!a || a.tipo !== 'mision') throw new ErrorApi(404, 'mision_no_encontrada');
  return a;
}

export async function evidenciasPendientes(u: Usuario, aulaId: string) {
  await aulaPermitida(u, aulaId);
  const r = await db()
    .collection(COL.evidencias)
    .where('aulaId', '==', aulaId)
    .where('estado', '==', 'pendiente')
    .orderBy('creado', 'asc')
    .get();
  return r.docs.map((d) => {
    const e = d.data() as EvidenciaDoc;
    const m = misionDe(e.misionId);
    return {
      id: d.id,
      misionId: e.misionId,
      mision: m.titulo,
      xp: m.xp,
      codigo: e.codigo,
      equipo: e.equipo,
      campos: m.campos
        .filter((c) => e.campos[c.id] !== undefined)
        .map((c) => ({ etiqueta: c.etiqueta, valor: String(e.campos[c.id]) })),
      creado: e.creado.toDate().toISOString(),
    };
  });
}

/**
 * Aprobar otorga el XP de la misión (30; campaña: 50) una sola vez; devolver
 * exige un comentario y permite reenviar.
 */
export async function revisarEvidencia(
  u: Usuario,
  id: string,
  accion: 'aprobar' | 'devolver',
  comentario: string | undefined,
  ahora: Date,
) {
  const texto = (comentario ?? '').trim();
  if (accion === 'devolver' && !texto) throw new ErrorApi(400, 'comentario_obligatorio');
  const f = db();
  const refEv = f.collection(COL.evidencias).doc(id);

  return f.runTransaction(async (tx) => {
    const sEv = await tx.get(refEv);
    if (!sEv.exists) throw new ErrorApi(404, 'evidencia_no_encontrada');
    const ev = sEv.data() as EvidenciaDoc;
    if (!puedeEditarAula(u, ev.aulaId)) throw new ErrorApi(403, 'aula_no_permitida');
    if (ev.estado !== 'pendiente') throw new ErrorApi(409, 'ya_revisada');

    const refProg = f.collection(COL.progreso).doc(ev.uid).collection(COL.actividades).doc(ev.misionId);
    const [sU, sAula, sProg] = await Promise.all([
      tx.get(refUsuario(ev.uid)),
      tx.get(f.collection(COL.aulas).doc(ev.aulaId)),
      tx.get(refProg),
    ]);
    const est = sU.data() as UsuarioDoc;
    const aula = sAula.data() as AulaDoc;
    const prog = sProg.exists ? (sProg.data() as ProgresoDoc) : null;
    const m = misionDe(ev.misionId);
    const t = Timestamp.fromDate(ahora);
    const por = codigoPersonal(u);
    const modulo = catalogo().actividades.get(ev.misionId)!.moduloId;

    tx.update(refEv, { estado: accion === 'aprobar' ? 'aprobada' : 'devuelta', comentario: texto || null, validadoPor: por, validadoEn: t });

    if (accion === 'devolver') {
      tx.set(refProg, { estado: 'en_curso', xp: 0, respuestas: {}, completadaEn: null, enviada: false } satisfies ProgresoDoc);
      tx.update(refUsuario(ev.uid), { [`resumen.${ev.misionId}`]: { estado: 'en_curso', enviada: false } });
      agregarEvento(tx, nuevoEvento(ev.uid, est, aula, 'evidencia_devuelta', ahora, { modulo, actividadId: ev.misionId, detalle: `por ${por}` }));
      return { estado: 'devuelta' as const, xpOtorgado: 0 };
    }

    // Aprobar: el XP se otorga una sola vez (y nunca al control).
    const yaCompletada = prog?.estado === 'completada';
    const xp = yaCompletada || est.brazo !== 'experimental' ? 0 : topeXp(m.xp, configJuego().xp.maxPorAccion);
    if (!yaCompletada) {
      tx.set(refProg, { estado: 'completada', xp, respuestas: {}, completadaEn: t, validadoPor: por, enviada: false } satisfies ProgresoDoc);
      tx.update(refUsuario(ev.uid), { [`resumen.${ev.misionId}`]: { estado: 'completada' }, xp: FieldValue.increment(xp) });
    }
    agregarEvento(tx, nuevoEvento(ev.uid, est, aula, 'evidencia_aprobada', ahora, { modulo, actividadId: ev.misionId, xp, detalle: `por ${por}` }));
    return { estado: 'aprobada' as const, xpOtorgado: xp };
  });
}

// ───────────────────────── Encuentros y grupo (PP4) ─────────────────────────

const ENCUENTROS = ['enc-1', 'enc-2', 'enc-3'] as const;
export type EncuentroId = (typeof ENCUENTROS)[number];
export const esEncuentro = (x: string): x is EncuentroId => (ENCUENTROS as readonly string[]).includes(x);

export async function encuentrosAula(u: Usuario, aulaId: string) {
  const aula = await aulaPermitida(u, aulaId);
  const refs = ENCUENTROS.map((e) => db().collection(COL.aulas).doc(aulaId).collection(COL.encuentros).doc(e));
  const snaps = await db().getAll(...refs);
  return {
    enlaceGrupo: aula.enlaceGrupo,
    encuentros: ENCUENTROS.map((id, i) => {
      const a = catalogo().actividades.get(id)!.actividad;
      const d = snaps[i]?.data() as EncuentroDoc | undefined;
      return {
        id,
        titulo: a.titulo,
        dia: a.dia,
        fecha: fechaCorta(fechaApertura(aula.fechaInicio, a.dia)),
        enlace: d?.enlace ?? null,
        codigoDefinido: !!d?.codigoHash,
      };
    }),
  };
}

export function validarEnlace(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
    return u.toString();
  } catch {
    throw new ErrorApi(400, 'enlace_invalido');
  }
}

/** Guarda el enlace y/o el código de asistencia (solo su hash). El código se devuelve una vez, al guardarlo. */
export async function guardarEncuentro(
  u: Usuario,
  aulaId: string,
  encId: EncuentroId,
  datos: { enlace?: string | null; codigo?: string },
  ahora: Date,
) {
  await aulaPermitida(u, aulaId, true);
  const cambios: Partial<EncuentroDoc> = { actualizadoPor: codigoPersonal(u), actualizado: Timestamp.fromDate(ahora) };
  if (datos.enlace !== undefined) cambios.enlace = validarEnlace(datos.enlace);
  let codigoGuardado: string | null = null;
  if (datos.codigo !== undefined) {
    const c = datos.codigo.replace(/\s+/g, '').toUpperCase();
    if (c.length < 4) throw new ErrorApi(400, 'codigo_corto');
    cambios.codigoHash = hashCodigoAsistencia(c);
    codigoGuardado = c;
  }
  const ref = db().collection(COL.aulas).doc(aulaId).collection(COL.encuentros).doc(encId);
  await ref.set(cambios, { merge: true });
  const d = (await ref.get()).data() as EncuentroDoc;
  return { id: encId, enlace: d.enlace ?? null, codigoDefinido: !!d.codigoHash, codigoGuardado };
}

export async function guardarEnlaceGrupo(u: Usuario, aulaId: string, enlace: string | null) {
  await aulaPermitida(u, aulaId, true);
  const enlaceGrupo = validarEnlace(enlace);
  await db().collection(COL.aulas).doc(aulaId).update({ enlaceGrupo });
  return { enlaceGrupo };
}

// ───────────────────────── Exportaciones (PP5, sección 13) ─────────────────────────

/** Aulas a exportar: una (si se pide) o todas las visibles; por defecto sin las de prueba. */
async function aulasAExportar(u: Usuario, aulaId: string | undefined, incluirPrueba: boolean): Promise<Aula[]> {
  if (aulaId) return [await aulaPermitida(u, aulaId)];
  if (u.rol === 'promotor') throw new ErrorApi(400, 'aula_requerida');
  const r = await db().collection(COL.aulas).orderBy('nombre').get();
  return r.docs.map((d) => ({ ...(d.data() as AulaDoc), id: d.id })).filter((a) => incluirPrueba || !a.prueba);
}

export async function csvEventos(u: Usuario, aulaId: string | undefined, incluirPrueba: boolean) {
  const aulas = await aulasAExportar(u, aulaId, incluirPrueba);
  const filas: (string | number | boolean | null | undefined)[][] = [];
  for (const a of aulas) {
    const r = await db().collection(COL.eventos).where('aulaId', '==', a.id).orderBy('ts', 'asc').get();
    for (const d of r.docs) {
      const e = d.data() as EventoDoc;
      const ts = e.ts?.toDate?.() ?? null;
      filas.push([
        ts?.toISOString(),
        ts ? fechaHoraLima(ts) : null,
        e.codigo,
        a.nombre,
        a.facultad,
        e.brazo,
        e.equipo,
        e.rol,
        e.dia,
        e.tipo,
        e.modulo,
        e.actividadId,
        e.pregunta,
        e.opcion,
        e.correcta,
        e.puntaje,
        e.max,
        e.xp,
        e.detalle,
      ]);
    }
  }
  return aCsv(COLUMNAS_EVENTOS, filas);
}

export async function csvParticipantes(u: Usuario, aulaId: string | undefined, incluirPrueba: boolean, ahora: Date) {
  const aulas = await aulasAExportar(u, aulaId, incluirPrueba);
  const cfg = configJuego();
  const filas: (string | number | boolean | null | undefined)[][] = [];
  for (const a of aulas) {
    const diaAula = diaEstudio(a.fechaInicio, ahora);
    const exp = a.brazo === 'experimental';
    for (const e of (await estudiantesDe(a.id)).sort((x, y) => (x.codigo ?? '').localeCompare(y.codigo ?? ''))) {
      const r = e.resumen ?? {};
      const completada = (id: string) => r[id]?.estado === 'completada';
      const ids = Object.keys(r).filter(completada);
      filas.push([
        e.codigo,
        a.nombre,
        a.facultad,
        a.brazo,
        exp ? e.equipo : null,
        e.xp ?? 0,
        exp ? nivel(e.xp ?? 0, cfg.niveles).nombre : null,
        ids.length,
        ids.filter((id) => /^reto-s\d+$/.test(id)).length,
        racha(e.diasConReto ?? [], diaAula),
        (e.diasActivos ?? []).length,
        exp && completada('mision1') ? (r.mision1?.puntaje ?? null) : null,
        e.ultimoAcceso?.toDate().toISOString() ?? null,
        e.consentimiento?.fecha?.toDate().toISOString() ?? null,
        e.retirado,
      ]);
    }
  }
  return aCsv(COLUMNAS_PARTICIPANTES, filas);
}

export function nombreArchivo(base: string, aulaId: string | undefined, ahora: Date) {
  const limpio = (aulaId ?? 'todas').replace(/[^a-zA-Z0-9-]/g, '');
  return `${base}-${limpio}-${fechaLima(ahora)}.csv`;
}

export const EQUIPOS_VALIDOS = EQUIPOS;
