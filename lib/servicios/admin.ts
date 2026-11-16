/**
 * Panel del administrador (PA1, PA4, PA5): aulas, participantes y
 * configuración del estudio. SOLO SERVIDOR.
 */
import 'server-only';
import { randomInt } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Usuario } from '../api';
import { ErrorApi } from '../errores';
import { db } from '../firebase-admin';
import { type Brazo, EQUIPOS, type Equipo, equipoConMenos, esFechaIso, generarCodigoAula } from '../juego';
import { type AulaDoc, COL, type ConfigEstudioDoc, type UsuarioDoc } from '../modelo';
import { agregarEvento, nuevoEvento } from './eventos';
import { resumenAula } from './panel';

const rnd = () => randomInt(0, 2 ** 32) / 2 ** 32;
const equiposVacios = () => Object.fromEntries(EQUIPOS.map((e) => [e, 0])) as Record<Equipo, number>;
const porDe = (u: Usuario) => u.codigo ?? u.uid;

// ───────────────────────── PA1 Aulas ─────────────────────────

export async function aulasAdmin(ahora: Date) {
  const r = await db().collection(COL.aulas).orderBy('nombre').get();
  return r.docs.map((d) => resumenAula({ ...(d.data() as AulaDoc), id: d.id }, ahora));
}

/** Reserva un código de unión único dentro de la transacción (lee antes de escribir). */
async function codigoLibre(tx: FirebaseFirestore.Transaction): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const c = generarCodigoAula(rnd);
    if (!(await tx.get(db().collection(COL.codigosUnion).doc(c))).exists) return c;
  }
  throw new ErrorApi(500, 'sin_codigo_disponible');
}

export interface DatosAula {
  nombre: string;
  facultad: string;
  brazo: Brazo;
  fechaInicio: string;
  capacidad: number;
  prueba: boolean;
}

export async function crearAula(u: Usuario, datos: DatosAula, ahora: Date) {
  if (!esFechaIso(datos.fechaInicio)) throw new ErrorApi(400, 'fecha_invalida');
  const f = db();
  const ref = f.collection(COL.aulas).doc();
  return f.runTransaction(async (tx) => {
    const codigoUnion = await codigoLibre(tx);
    const aula: AulaDoc = {
      nombre: datos.nombre.trim(),
      facultad: datos.facultad.trim(),
      brazo: datos.brazo,
      fechaInicio: datos.fechaInicio,
      capacidad: datos.capacidad,
      inscritos: 0,
      equipos: equiposVacios(),
      codigoUnion,
      activa: true,
      prueba: datos.prueba,
      enlaceGrupo: null,
      creadoPor: porDe(u),
      creado: Timestamp.fromDate(ahora),
    };
    tx.create(ref, aula);
    tx.create(f.collection(COL.codigosUnion).doc(codigoUnion), { aulaId: ref.id });
    return { aula: resumenAula({ ...aula, id: ref.id }, ahora) };
  });
}

export async function editarAula(
  u: Usuario,
  id: string,
  cambios: { activa?: boolean; fechaInicio?: string; nombre?: string; facultad?: string; capacidad?: number; regenerarCodigo?: boolean },
  ahora: Date,
) {
  if (cambios.fechaInicio !== undefined && !esFechaIso(cambios.fechaInicio)) throw new ErrorApi(400, 'fecha_invalida');
  const f = db();
  const ref = f.collection(COL.aulas).doc(id);
  return f.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw new ErrorApi(404, 'aula_no_encontrada');
    const aula = s.data() as AulaDoc;
    const upd: Partial<AulaDoc> = {};
    if (cambios.activa !== undefined) upd.activa = cambios.activa;
    if (cambios.fechaInicio !== undefined) upd.fechaInicio = cambios.fechaInicio;
    if (cambios.nombre !== undefined) upd.nombre = cambios.nombre.trim();
    if (cambios.facultad !== undefined) upd.facultad = cambios.facultad.trim();
    if (cambios.capacidad !== undefined) {
      if (cambios.capacidad < aula.inscritos) throw new ErrorApi(409, 'capacidad_menor', { inscritos: aula.inscritos });
      upd.capacidad = cambios.capacidad;
    }
    if (cambios.regenerarCodigo) {
      const nuevo = await codigoLibre(tx);
      tx.delete(f.collection(COL.codigosUnion).doc(aula.codigoUnion));
      tx.create(f.collection(COL.codigosUnion).doc(nuevo), { aulaId: id });
      upd.codigoUnion = nuevo;
    }
    tx.update(ref, upd);
    return { aula: resumenAula({ ...aula, ...upd, id }, ahora), por: porDe(u) };
  });
}

// ───────────────────────── PA4 Participantes ─────────────────────────

/**
 * Mueve a un estudiante a otra aula (con confirmación en la interfaz). Si el
 * aula es del experimental, recibe el equipo con menos integrantes. Su
 * progreso se conserva y queda el evento `aula_movida`.
 */
export async function moverParticipante(u: Usuario, uid: string, aulaDestino: string, ahora: Date) {
  const f = db();
  const refU = f.collection(COL.usuarios).doc(uid);
  return f.runTransaction(async (tx) => {
    const sU = await tx.get(refU);
    if (!sU.exists) throw new ErrorApi(404, 'usuario_no_encontrado');
    const e = sU.data() as UsuarioDoc;
    if (e.rol !== 'estudiante') throw new ErrorApi(400, 'no_es_estudiante');
    if (e.aulaId === aulaDestino) throw new ErrorApi(409, 'misma_aula');
    const refDestino = f.collection(COL.aulas).doc(aulaDestino);
    const sD = await tx.get(refDestino);
    if (!sD.exists) throw new ErrorApi(404, 'aula_no_encontrada');
    const destino = sD.data() as AulaDoc;
    const refOrigen = e.aulaId ? f.collection(COL.aulas).doc(e.aulaId) : null;
    const sO = refOrigen ? await tx.get(refOrigen) : null;
    if (destino.inscritos >= destino.capacidad) throw new ErrorApi(409, 'aula_completa');

    const equipo = destino.brazo === 'experimental' ? equipoConMenos(destino.equipos) : null;
    if (refOrigen && sO?.exists) {
      tx.update(refOrigen, {
        inscritos: FieldValue.increment(-1),
        ...(e.equipo ? { [`equipos.${e.equipo}`]: FieldValue.increment(-1) } : {}),
      });
    }
    tx.update(refDestino, { inscritos: FieldValue.increment(1), ...(equipo ? { [`equipos.${equipo}`]: FieldValue.increment(1) } : {}) });
    const cambios = { aulaId: aulaDestino, brazo: destino.brazo, equipo };
    tx.update(refU, cambios);
    agregarEvento(
      tx,
      nuevoEvento(uid, { ...e, ...cambios }, destino, 'aula_movida', ahora, {
        detalle: `${e.aulaId ?? 'sin aula'} → ${aulaDestino} · por ${porDe(u)}`,
      }),
    );
    return { aulaId: aulaDestino, brazo: destino.brazo, equipo };
  });
}

/** Marca (o desmarca) el retiro: no puede usar la app, sale del ranking y queda marcado en los CSV. */
export async function marcarRetiro(u: Usuario, uid: string, retirado: boolean, ahora: Date) {
  const f = db();
  const refU = f.collection(COL.usuarios).doc(uid);
  return f.runTransaction(async (tx) => {
    const sU = await tx.get(refU);
    if (!sU.exists) throw new ErrorApi(404, 'usuario_no_encontrado');
    const e = sU.data() as UsuarioDoc;
    if (e.rol !== 'estudiante') throw new ErrorApi(400, 'no_es_estudiante');
    const aula = e.aulaId ? ((await tx.get(f.collection(COL.aulas).doc(e.aulaId))).data() as AulaDoc | undefined) : undefined;
    tx.update(refU, { retirado });
    agregarEvento(tx, nuevoEvento(uid, e, aula ?? null, 'retirado', ahora, { detalle: `${retirado ? 'retirado' : 'reactivado'} · por ${porDe(u)}` }));
    return { retirado };
  });
}

// ───────────────────────── PA5 Configuración ─────────────────────────

export const CLAVES_ENLACES = ['o1', 'o2', 'satisfaccion', 'o3', 'servicioMedico'] as const;
type Enlaces = ConfigEstudioDoc['enlaces'];

/** Acepta http(s) y conserva el texto tal cual (incluido el marcador {codigo}). */
function enlaceConMarcador(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(s.replaceAll('{codigo}', 'G-XXXXX'));
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
  } catch {
    throw new ErrorApi(400, 'enlace_invalido');
  }
  return s;
}

export async function leerConfig() {
  const d = (await db().collection(COL.config).doc('estudio').get()).data() as ConfigEstudioDoc | undefined;
  const vacio: Enlaces = { o1: null, o2: null, satisfaccion: null, o3: null, servicioMedico: null };
  return {
    enlaces: { ...vacio, ...(d?.enlaces ?? {}) },
    actualizado: d?.actualizado?.toDate().toISOString() ?? null,
  };
}

export async function guardarConfig(u: Usuario, enlaces: Partial<Record<(typeof CLAVES_ENLACES)[number], string | null>>, ahora: Date) {
  const limpios = Object.fromEntries(CLAVES_ENLACES.map((k) => [k, enlaceConMarcador(enlaces[k])])) as Enlaces;
  await db()
    .collection(COL.config)
    .doc('estudio')
    .set({ enlaces: limpios, actualizadoPor: porDe(u), actualizado: Timestamp.fromDate(ahora) } satisfies ConfigEstudioDoc);
  return { enlaces: limpios };
}
