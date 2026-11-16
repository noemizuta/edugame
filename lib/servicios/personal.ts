/**
 * Gestión de roles por el admin (decisión 6): buscar usuarios registrados y
 * cambiarles el rol. SOLO SERVIDOR.
 */
import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import type { Usuario } from '../api';
import { ErrorApi } from '../errores';
import { db } from '../firebase-admin';
import { type Rol, esCodigoParticipante, normalizarCodigoParticipante } from '../juego';
import { type AulaDoc, COL, type IdentidadDoc, type UsuarioDoc } from '../modelo';
import { agregarEvento, nuevoEvento } from './eventos';

export interface FilaUsuario {
  uid: string;
  codigo: string | null;
  rol: Rol;
  email: string | null;
  aula: { id: string; nombre: string } | null;
  aulasPromotor: string[];
  retirado: boolean;
}

async function filas(uids: string[]): Promise<FilaUsuario[]> {
  if (uids.length === 0) return [];
  const f = db();
  const [usuarios, identidades] = await Promise.all([
    f.getAll(...uids.map((u) => f.collection(COL.usuarios).doc(u))),
    f.getAll(...uids.map((u) => f.collection(COL.identidades).doc(u))),
  ]);
  const aulaIds = [...new Set(usuarios.map((s) => (s.data() as UsuarioDoc | undefined)?.aulaId).filter((x): x is string => !!x))];
  const aulas = aulaIds.length ? await f.getAll(...aulaIds.map((a) => f.collection(COL.aulas).doc(a))) : [];
  const nombres = new Map(aulas.map((a) => [a.id, (a.data() as AulaDoc | undefined)?.nombre ?? a.id]));

  return usuarios
    .filter((s) => s.exists)
    .map((s, i) => {
      const u = s.data() as UsuarioDoc;
      return {
        uid: s.id,
        codigo: u.codigo,
        rol: u.rol,
        email: (identidades[i]?.data() as IdentidadDoc | undefined)?.email ?? null,
        aula: u.aulaId ? { id: u.aulaId, nombre: nombres.get(u.aulaId) ?? u.aulaId } : null,
        aulasPromotor: u.aulasPromotor ?? [],
        retirado: u.retirado,
      };
    });
}

/**
 * Busca por código (G-XXXXX) o por correo exacto. Ver el correo de un
 * estudiante queda registrado como `consulta_identidad`.
 */
export async function buscarUsuarios(admin: Usuario, q: string, ahora: Date): Promise<FilaUsuario[]> {
  const texto = q.trim();
  const f = db();
  let uids: string[] = [];
  if (texto.includes('@')) {
    const r = await f.collection(COL.identidades).where('email', '==', texto.toLowerCase()).limit(5).get();
    uids = r.docs.map((d) => d.id);
  } else {
    const codigo = normalizarCodigoParticipante(texto);
    if (!esCodigoParticipante(codigo)) throw new ErrorApi(400, 'busqueda_invalida');
    const s = await f.collection(COL.codigosParticipante).doc(codigo).get();
    if (s.exists) uids = [(s.data() as { uid: string }).uid];
  }
  const resultado = await filas(uids);

  const estudiantes = resultado.filter((r) => r.rol === 'estudiante');
  if (estudiantes.length > 0) {
    const lote = f.batch();
    agregarEvento(
      lote,
      nuevoEvento(admin.uid, admin, null, 'consulta_identidad', ahora, {
        detalle: `consultó ${estudiantes.map((e) => e.codigo).join(', ')}`,
      }),
    );
    await lote.commit();
  }
  return resultado;
}

/** Aula tal como la muestra «Población del estudio». */
export interface AulaPoblacion {
  id: string;
  nombre: string;
  brazo: 'experimental' | 'control';
  capacidad: number;
  activa: boolean;
  prueba: boolean;
}

/**
 * «Población del estudio» (a demanda): todas las aulas y todos los usuarios con
 * su rol, para agruparlos en el navegador. Lee un documento por usuario, así que
 * la interfaz solo lo pide cuando el admin toca «Mostrar población».
 * Los estudiantes van sin correo (solo su código); solo se leen las identidades
 * del personal.
 */
export async function poblacion(): Promise<{ aulas: AulaPoblacion[]; usuarios: FilaUsuario[] }> {
  const f = db();
  const [aulasSnap, usuariosSnap] = await Promise.all([
    f.collection(COL.aulas).orderBy('nombre').get(),
    f.collection(COL.usuarios).select('codigo', 'rol', 'aulaId', 'aulasPromotor', 'retirado').get(),
  ]);
  const aulas = aulasSnap.docs.map((d) => {
    const a = d.data() as AulaDoc;
    return { id: d.id, nombre: a.nombre, brazo: a.brazo, capacidad: a.capacidad, activa: a.activa, prueba: a.prueba };
  });
  const nombres = new Map(aulas.map((a) => [a.id, a.nombre]));

  const personal = usuariosSnap.docs.filter((d) => (d.get('rol') as Rol) !== 'estudiante');
  const identidades = personal.length ? await f.getAll(...personal.map((d) => f.collection(COL.identidades).doc(d.id))) : [];
  const correos = new Map(identidades.map((s) => [s.id, (s.data() as IdentidadDoc | undefined)?.email ?? null]));

  const usuarios = usuariosSnap.docs.map((d): FilaUsuario => {
    const u = d.data() as Pick<UsuarioDoc, 'codigo' | 'rol' | 'aulaId' | 'aulasPromotor' | 'retirado'>;
    return {
      uid: d.id,
      codigo: u.codigo ?? null,
      rol: u.rol,
      email: u.rol === 'estudiante' ? null : (correos.get(d.id) ?? null),
      aula: u.aulaId ? { id: u.aulaId, nombre: nombres.get(u.aulaId) ?? u.aulaId } : null,
      aulasPromotor: u.aulasPromotor ?? [],
      retirado: u.retirado ?? false,
    };
  });
  return { aulas, usuarios };
}

/**
 * Cambia el rol de un usuario registrado.
 * - Nadie cambia su propio rol; no se puede quitar el rol al último admin.
 * - Un estudiante que pasa a personal sale de su aula (se descuentan inscritos y equipo).
 * - Un promotor recibe sus aulas (`aulasPromotor`); los demás roles quedan sin aulas.
 */
export async function cambiarRol(admin: Usuario, uid: string, rol: Rol, aulasPromotor: string[], ahora: Date) {
  if (uid === admin.uid) throw new ErrorApi(403, 'propio_rol');
  const f = db();
  const ref = f.collection(COL.usuarios).doc(uid);

  await f.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ErrorApi(404, 'usuario_no_encontrado');
    const u = snap.data() as UsuarioDoc;

    if (u.rol === 'admin' && rol !== 'admin') {
      const admins = await tx.get(f.collection(COL.usuarios).where('rol', '==', 'admin'));
      if (admins.size <= 1) throw new ErrorApi(409, 'ultimo_admin');
    }

    const aulas = rol === 'promotor' ? [...new Set(aulasPromotor)] : [];
    if (aulas.length > 0) {
      const snaps = await tx.getAll(...aulas.map((a) => f.collection(COL.aulas).doc(a)));
      if (snaps.some((s) => !s.exists)) throw new ErrorApi(400, 'aula_no_encontrada');
    }
    const aulaActual = u.aulaId ? await tx.get(f.collection(COL.aulas).doc(u.aulaId)) : null;

    const cambios: Partial<UsuarioDoc> = { rol, aulasPromotor: aulas };
    if (rol !== 'estudiante' && u.aulaId) {
      // Sale del aula: su progreso se conserva, pero queda fuera del ranking y de las exportaciones.
      cambios.aulaId = null;
      cambios.brazo = null;
      cambios.equipo = null;
      if (aulaActual?.exists) {
        tx.update(aulaActual.ref, {
          inscritos: FieldValue.increment(-1),
          ...(u.equipo ? { [`equipos.${u.equipo}`]: FieldValue.increment(-1) } : {}),
        });
      }
    }
    tx.update(ref, cambios);
    const aula = aulaActual?.exists ? (aulaActual.data() as AulaDoc) : null;
    agregarEvento(
      tx,
      nuevoEvento(uid, { ...u, rol }, aula, 'rol_cambiado', ahora, {
        aulaId: u.aulaId,
        brazo: u.brazo,
        equipo: u.equipo,
        detalle: `${u.rol} → ${rol}${aulas.length ? ` (${aulas.join(', ')})` : ''} · por ${admin.codigo ?? admin.uid}`,
      }),
    );
  });
  return (await filas([uid]))[0]!;
}

/** Lista de aulas para elegir las de un promotor. */
export async function listarAulas() {
  const r = await db().collection(COL.aulas).orderBy('nombre').get();
  return r.docs.map((d) => {
    const a = d.data() as AulaDoc;
    return { id: d.id, nombre: a.nombre, brazo: a.brazo, inscritos: a.inscritos, capacidad: a.capacidad, activa: a.activa };
  });
}
