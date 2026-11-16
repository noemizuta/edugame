/**
 * Sesión, consentimiento, unión al aula y avatar (secciones 5.1, 5.2 y 5.4;
 * decisión 6 para el primer admin). SOLO SERVIDOR.
 */
import 'server-only';
import { randomInt } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { TokenVerificado } from '../auth-server';
import { dominioPermitido } from '../auth-server';
import type { Usuario } from '../api';
import { configJuego } from '../contenido';
import { ErrorApi } from '../errores';
import { db } from '../firebase-admin';
import {
  type Equipo,
  EQUIPOS,
  HORA_MS,
  type Paso,
  equipoConMenos,
  esCodigoAula,
  generarCodigoParticipante,
  limiteAgotado,
  normalizarCodigoAula,
  siguientePaso,
  sumarFallo,
} from '../juego';
import {
  type AulaDoc,
  COL,
  type IdentidadDoc,
  type LimiteDoc,
  type SistemaDoc,
  type UsuarioDoc,
} from '../modelo';
import { agregarEvento, nuevoEvento } from './eventos';

const rnd = () => randomInt(0, 2 ** 32) / 2 ** 32;
const MAX_INTENTOS_CODIGO = 10;

export interface PerfilSesion {
  rol: UsuarioDoc['rol'];
  /** Solo para estudiantes. */
  codigo: string | null;
  avatar: string | null;
  brazo: UsuarioDoc['brazo'];
  equipo: Equipo | null;
  consentimiento: boolean;
  aula: { id: string; nombre: string; brazo: AulaDoc['brazo'] } | null;
}

export interface RespuestaSesion {
  rol: UsuarioDoc['rol'];
  siguientePaso: Paso;
  perfil: PerfilSesion;
}

export function perfilDe(u: UsuarioDoc, aulaId: string | null, aula: AulaDoc | null): PerfilSesion {
  const estudiante = u.rol === 'estudiante';
  return {
    rol: u.rol,
    codigo: estudiante ? u.codigo : null,
    avatar: u.avatar,
    brazo: u.brazo,
    equipo: u.equipo,
    consentimiento: !!u.consentimiento,
    aula: aula && aulaId ? { id: aulaId, nombre: aula.nombre, brazo: aula.brazo } : null,
  };
}

const refUsuario = (uid: string) => db().collection(COL.usuarios).doc(uid);
const refAula = (id: string) => db().collection(COL.aulas).doc(id);

/**
 * POST /api/sesion: crea o actualiza `usuarios` e `identidades`.
 * - La primera cuenta del sitio queda como admin (reserva en config/sistema).
 * - Las demás cuentas nuevas son estudiantes, con un código G-XXXXX único.
 * - `ultimoAcceso` (y el evento `sesion`) se actualizan como máximo una vez por hora.
 */
export async function crearSesion(token: TokenVerificado, ahora: Date): Promise<RespuestaSesion> {
  return db().runTransaction(async (tx) => {
    const ref = refUsuario(token.uid);
    const refIdentidad = db().collection(COL.identidades).doc(token.uid);
    const snap = await tx.get(ref);

    if (!snap.exists) {
      const refSistema = db().collection(COL.config).doc('sistema');
      const sistema = await tx.get(refSistema);
      const primerAdmin = !sistema.exists;
      if (!primerAdmin && !dominioPermitido(token.email)) throw new ErrorApi(403, 'dominio_no_permitido');

      // Código anónimo único, reservado en codigosParticipante (todas las lecturas antes de escribir).
      let codigo: string | null = null;
      for (let i = 0; i < 12 && !codigo; i++) {
        const c = generarCodigoParticipante(rnd);
        if (!(await tx.get(db().collection(COL.codigosParticipante).doc(c))).exists) codigo = c;
      }
      if (!codigo) throw new ErrorApi(500, 'sin_codigo_disponible');

      const t = Timestamp.fromDate(ahora);
      const usuario: UsuarioDoc = {
        codigo,
        rol: primerAdmin ? 'admin' : 'estudiante',
        aulaId: null,
        brazo: null,
        equipo: null,
        aulasPromotor: [],
        avatar: null,
        consentimiento: null,
        xp: 0,
        ultimoAcceso: t,
        retirado: false,
        creado: t,
      };
      const identidad: IdentidadDoc = { email: token.email, nombreGoogle: token.nombre, creado: t, ultimoIngreso: t };
      tx.create(ref, usuario);
      tx.create(refIdentidad, identidad);
      tx.create(db().collection(COL.codigosParticipante).doc(codigo), { uid: token.uid });
      if (primerAdmin) tx.create(refSistema, { primerAdmin: token.uid, en: t } satisfies SistemaDoc);
      agregarEvento(tx, nuevoEvento(token.uid, usuario, null, 'sesion', ahora, primerAdmin ? { detalle: 'primer_admin' } : {}));
      return { rol: usuario.rol, siguientePaso: siguientePaso(usuario), perfil: perfilDe(usuario, null, null) };
    }

    const u = snap.data() as UsuarioDoc;
    if (u.rol === 'estudiante' && u.retirado) throw new ErrorApi(403, 'retirado');
    if (u.rol === 'estudiante' && !dominioPermitido(token.email)) throw new ErrorApi(403, 'dominio_no_permitido');

    const aulaSnap = u.aulaId ? await tx.get(refAula(u.aulaId)) : null;
    const aula = aulaSnap?.exists ? (aulaSnap.data() as AulaDoc) : null;

    const ultimo = u.ultimoAcceso?.toMillis() ?? 0;
    if (ahora.getTime() - ultimo >= HORA_MS) {
      const t = Timestamp.fromDate(ahora);
      tx.update(ref, { ultimoAcceso: t });
      tx.set(refIdentidad, { email: token.email, nombreGoogle: token.nombre, ultimoIngreso: t }, { merge: true });
      agregarEvento(tx, nuevoEvento(token.uid, u, aula, 'sesion', ahora));
    }
    return { rol: u.rol, siguientePaso: siguientePaso(u), perfil: perfilDe(u, u.aulaId, aula) };
  });
}

/** POST /api/consentimiento: registra la versión y la fecha (idempotente). */
export async function aceptarConsentimiento(usuario: Usuario, version: string, ahora: Date) {
  const cfg = configJuego().consentimiento;
  if (version !== cfg.version) throw new ErrorApi(400, 'version_invalida', { version: cfg.version });
  if (usuario.consentimiento) return { siguientePaso: siguientePaso(usuario) };

  const consentimiento = { version, fecha: Timestamp.fromDate(ahora) };
  const lote = db().batch();
  lote.update(refUsuario(usuario.uid), { consentimiento });
  agregarEvento(lote, nuevoEvento(usuario.uid, usuario, null, 'consentimiento', ahora, { detalle: `version ${version}` }));
  await lote.commit();
  return { siguientePaso: siguientePaso({ ...usuario, consentimiento }) };
}

type ResultadoUnion =
  | { ok: true; aulaId: string; aula: AulaDoc; equipo: Equipo | null }
  | { ok: false; error: ErrorApi };

/**
 * POST /api/aulas/unirse (sección 5.2), en una transacción. Los códigos
 * incorrectos cuentan para el límite de 10 por hora; el contador se guarda
 * aunque la unión falle.
 */
export async function unirseAula(usuario: Usuario, codigoEscrito: string, ahora: Date) {
  const codigo = normalizarCodigoAula(codigoEscrito);
  const refLimite = db().collection(COL.limites).doc(usuario.uid);

  const r = await db().runTransaction<ResultadoUnion>(async (tx) => {
    const snapU = await tx.get(refUsuario(usuario.uid));
    const snapL = await tx.get(refLimite);
    const u = snapU.data() as UsuarioDoc;
    const limite = (snapL.data() as LimiteDoc | undefined)?.ventanas?.unirse;
    const ventana = limite ? { desde: limite.desde.toMillis(), intentos: limite.intentos } : undefined;

    if (limiteAgotado(ventana, ahora.getTime(), MAX_INTENTOS_CODIGO)) {
      return { ok: false, error: new ErrorApi(429, 'demasiados_intentos') };
    }

    if (u.aulaId) {
      const actual = await tx.get(refAula(u.aulaId));
      const nombre = (actual.data() as AulaDoc | undefined)?.nombre ?? '';
      return { ok: false, error: new ErrorApi(409, 'ya_en_aula', { aula: nombre }) };
    }

    const snapCodigo = esCodigoAula(codigo) ? await tx.get(db().collection(COL.codigosUnion).doc(codigo)) : null;
    const aulaId = snapCodigo?.exists ? (snapCodigo.data() as { aulaId: string }).aulaId : null;
    const snapAula = aulaId ? await tx.get(refAula(aulaId)) : null;

    if (!aulaId || !snapAula?.exists) {
      const nueva = sumarFallo(ventana, ahora.getTime());
      tx.set(
        refLimite,
        { ventanas: { unirse: { desde: Timestamp.fromMillis(nueva.desde), intentos: nueva.intentos } } },
        { merge: true },
      );
      return { ok: false, error: new ErrorApi(404, 'codigo_incorrecto') };
    }

    const aula = snapAula.data() as AulaDoc;
    if (!aula.activa) return { ok: false, error: new ErrorApi(409, 'aula_inactiva') };
    if (aula.inscritos >= aula.capacidad) return { ok: false, error: new ErrorApi(409, 'aula_completa') };

    const equipo = aula.brazo === 'experimental' ? equipoConMenos(aula.equipos) : null;
    const cambios = { aulaId, brazo: aula.brazo, equipo };
    tx.update(refUsuario(usuario.uid), cambios);
    tx.update(refAula(aulaId), {
      inscritos: FieldValue.increment(1),
      ...(equipo ? { [`equipos.${equipo}`]: FieldValue.increment(1) } : {}),
    });
    agregarEvento(tx, nuevoEvento(usuario.uid, { ...u, ...cambios }, aula, 'unirse_aula', ahora));
    return { ok: true, aulaId, aula, equipo };
  });

  if (!r.ok) throw r.error;
  return {
    aula: { id: r.aulaId, nombre: r.aula.nombre, brazo: r.aula.brazo },
    equipo: r.equipo,
    siguientePaso: '/bienvenida-aula' as Paso,
  };
}

/** PATCH /api/perfil: guarda el avatar (uno de los 8 de config-juego.json). */
export async function guardarAvatar(usuario: Usuario, avatar: string, ahora: Date) {
  if (!configJuego().avatares.includes(avatar)) throw new ErrorApi(400, 'avatar_invalido');
  const aula = usuario.aulaId ? ((await refAula(usuario.aulaId).get()).data() as AulaDoc | undefined) : undefined;
  const lote = db().batch();
  lote.update(refUsuario(usuario.uid), { avatar });
  agregarEvento(lote, nuevoEvento(usuario.uid, usuario, aula ?? null, 'avatar', ahora, { detalle: avatar }));
  await lote.commit();
  return { avatar, siguientePaso: siguientePaso({ ...usuario, avatar }) };
}

export const equiposVacios = (): Record<Equipo, number> =>
  Object.fromEntries(EQUIPOS.map((e) => [e, 0])) as Record<Equipo, number>;
