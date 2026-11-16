/**
 * Interfaz de datos de los servicios del participante (DECISIONES · Arquitectura).
 * Los servicios leen con un `Lector` y devuelven una lista de `Escritura`s; el
 * almacén las aplica de forma atómica. La vista previa (fase 5) usará un
 * almacén en memoria que no escribe nada. SOLO SERVIDOR.
 */
import 'server-only';
import { FieldPath, FieldValue, type Transaction, Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase-admin';
import {
  type AulaDoc,
  COL,
  type ConfigEstudioDoc,
  type EncuentroDoc,
  type EvidenciaDoc,
  type LimiteDoc,
  type ProgresoDoc,
  type ResumenActividad,
  type UsuarioDoc,
} from '../modelo';
import { calendario } from '../contenido';
import { esEventoActivo } from '../juego';
import type { nuevoEvento } from './eventos';

export type Aula = AulaDoc & { id: string };
export type Evidencia = EvidenciaDoc & { id: string };

export interface Lector {
  aula(aulaId: string): Promise<Aula | null>;
  progreso(uid: string, actividadId: string): Promise<ProgresoDoc | null>;
  encuentro(aulaId: string, encuentroId: string): Promise<EncuentroDoc | null>;
  configEstudio(): Promise<ConfigEstudioDoc | null>;
  limite(uid: string): Promise<LimiteDoc | null>;
  /** Evidencias del participante para una misión, de la más reciente a la más antigua. */
  evidencias(uid: string, misionId: string): Promise<Evidencia[]>;
  /** Estudiantes del aula (para el ranking). */
  estudiantesAula(aulaId: string): Promise<(UsuarioDoc & { uid: string })[]>;
}

export type Escritura =
  | {
      tipo: 'progreso';
      uid: string;
      actividadId: string;
      doc: ProgresoDoc;
      resumen: ResumenActividad;
      xp: number;
      /** Si completa un reto: día del estudio, para la racha. */
      diaReto?: number;
    }
  | { tipo: 'evento'; evento: ReturnType<typeof nuevoEvento> }
  | { tipo: 'evidencia'; doc: EvidenciaDoc }
  | { tipo: 'limite'; uid: string; clave: string; desde: number; intentos: number };

export interface Almacen {
  /** ¿Se guardan los cambios? (false en la vista previa). */
  readonly escribe: boolean;
  lector(): Lector;
  transaccion<T>(fn: (l: Lector) => Promise<{ resultado: T; escrituras: Escritura[] }>): Promise<T>;
}

// ───────────────────────── Firestore ─────────────────────────

type Obtener = <D>(ref: FirebaseFirestore.DocumentReference) => Promise<D | null>;

function lectorFirestore(tx?: Transaction): Lector {
  const f = db();
  const obtener: Obtener = async <D,>(ref: FirebaseFirestore.DocumentReference) => {
    const s = tx ? await tx.get(ref) : await ref.get();
    return s.exists ? (s.data() as D) : null;
  };
  const consultar = (q: FirebaseFirestore.Query) => (tx ? tx.get(q) : q.get());

  return {
    async aula(aulaId) {
      const a = await obtener<AulaDoc>(f.collection(COL.aulas).doc(aulaId));
      return a ? { ...a, id: aulaId } : null;
    },
    progreso: (uid, actividadId) =>
      obtener<ProgresoDoc>(f.collection(COL.progreso).doc(uid).collection(COL.actividades).doc(actividadId)),
    encuentro: (aulaId, encuentroId) =>
      obtener<EncuentroDoc>(f.collection(COL.aulas).doc(aulaId).collection(COL.encuentros).doc(encuentroId)),
    configEstudio: () => obtener<ConfigEstudioDoc>(f.collection(COL.config).doc('estudio')),
    limite: (uid) => obtener<LimiteDoc>(f.collection(COL.limites).doc(uid)),
    async evidencias(uid, misionId) {
      const r = await consultar(f.collection(COL.evidencias).where('uid', '==', uid).where('misionId', '==', misionId));
      return r.docs
        .map((d) => ({ ...(d.data() as EvidenciaDoc), id: d.id }))
        .sort((a, b) => b.creado.toMillis() - a.creado.toMillis());
    },
    async estudiantesAula(aulaId) {
      const r = await consultar(f.collection(COL.usuarios).where('aulaId', '==', aulaId).where('rol', '==', 'estudiante'));
      return r.docs.map((d) => ({ ...(d.data() as UsuarioDoc), uid: d.id }));
    },
  };
}

function aplicar(tx: Transaction, e: Escritura) {
  const f = db();
  switch (e.tipo) {
    case 'progreso': {
      tx.set(f.collection(COL.progreso).doc(e.uid).collection(COL.actividades).doc(e.actividadId), e.doc);
      const refU = f.collection(COL.usuarios).doc(e.uid);
      if (e.xp > 0) tx.update(refU, new FieldPath('resumen', e.actividadId), e.resumen, 'xp', FieldValue.increment(e.xp));
      else tx.update(refU, new FieldPath('resumen', e.actividadId), e.resumen);
      if (e.diaReto !== undefined) tx.update(refU, { diasConReto: FieldValue.arrayUnion(e.diaReto) });
      return;
    }
    case 'evento':
      tx.create(f.collection(COL.eventos).doc(), e.evento);
      if (esEventoActivo(e.evento.tipo, e.evento.dia, calendario().duracionDias)) {
        tx.update(f.collection(COL.usuarios).doc(e.evento.uid), { diasActivos: FieldValue.arrayUnion(e.evento.dia) });
      }
      return;
    case 'evidencia':
      tx.create(f.collection(COL.evidencias).doc(), e.doc);
      return;
    case 'limite':
      tx.set(
        f.collection(COL.limites).doc(e.uid),
        { ventanas: { [e.clave]: { desde: Timestamp.fromMillis(e.desde), intentos: e.intentos } } },
        { merge: true },
      );
      return;
  }
}

export const almacenFirestore: Almacen = {
  escribe: true,
  lector: () => lectorFirestore(),
  transaccion: (fn) =>
    db().runTransaction(async (tx) => {
      const { resultado, escrituras } = await fn(lectorFirestore(tx));
      for (const e of escrituras) aplicar(tx, e);
      return resultado;
    }),
};
