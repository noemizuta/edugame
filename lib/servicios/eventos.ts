import 'server-only';
import { FieldValue, type Transaction, type WriteBatch } from 'firebase-admin/firestore';
import { db } from '../firebase-admin';
import { diaEstudio } from '../juego';
import { COL, type EventoDoc, type TipoEvento, type UsuarioDoc } from '../modelo';

type Extra = Partial<Omit<EventoDoc, 'ts' | 'uid' | 'tipo'>>;

/**
 * Documento de evento con aula, brazo, equipo, rol y día del estudio completados por el
 * servidor (sección 11). `aula` es el aula del usuario (o null).
 */
export function nuevoEvento(
  uid: string,
  usuario: Pick<UsuarioDoc, 'codigo' | 'aulaId' | 'brazo' | 'equipo' | 'rol'>,
  aula: { fechaInicio: string } | null,
  tipo: TipoEvento,
  ahora: Date,
  extra: Extra = {},
) {
  return {
    ts: FieldValue.serverTimestamp(),
    uid,
    codigo: usuario.codigo,
    aulaId: usuario.aulaId,
    brazo: usuario.brazo,
    equipo: usuario.equipo,
    rol: usuario.rol,
    dia: aula ? diaEstudio(aula.fechaInicio, ahora) : null,
    tipo,
    ...extra,
  };
}

/** Agrega un evento (solo se agregan; nunca se modifican). */
export function agregarEvento(escritor: Transaction | WriteBatch, evento: ReturnType<typeof nuevoEvento>) {
  escritor.create(db().collection(COL.eventos).doc(), evento);
}
