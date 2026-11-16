/**
 * Vista previa (PA6): las mismas respuestas que la API del participante, con un
 * perfil ficticio y SIN escribir nada (almacén en memoria). SOLO SERVIDOR.
 */
import 'server-only';
import { Timestamp } from 'firebase-admin/firestore';
import type { Usuario } from '../api';
import { configJuego } from '../contenido';
import { EQUIPOS, type Brazo, type Equipo, fechaLima, sumarDias } from '../juego';
import type { UsuarioDoc } from '../modelo';
import { type Almacen, type Aula, type Lector, almacenFirestore } from './almacen';
import { type Ctx, hashCodigoAsistencia } from './participante';

export const CODIGO_ASISTENCIA_VISTA_PREVIA = 'VISTA';

/** Aula ficticia en la que hoy es el día `dia` del estudio. */
export function aulaFicticia(brazo: Brazo, dia: number, ahora: Date): Aula {
  return {
    id: 'vista-previa',
    nombre: 'Aula de vista previa',
    facultad: '—',
    brazo,
    fechaInicio: sumarDias(fechaLima(ahora), 1 - dia),
    capacidad: 30,
    inscritos: 1,
    equipos: Object.fromEntries(EQUIPOS.map((e) => [e, e === 'E1' ? 1 : 0])) as Record<Equipo, number>,
    codigoUnion: 'VISTA0',
    activa: true,
    prueba: true,
    enlaceGrupo: null,
    creadoPor: 'vista-previa',
    creado: Timestamp.fromDate(ahora),
  };
}

export function usuarioFicticio(brazo: Brazo, ahora: Date): Usuario {
  const doc: UsuarioDoc = {
    codigo: 'G-VISTA',
    rol: 'estudiante',
    aulaId: 'vista-previa',
    brazo,
    equipo: brazo === 'experimental' ? 'E1' : null,
    aulasPromotor: [],
    avatar: configJuego().avatares[0]!,
    consentimiento: { version: configJuego().consentimiento.version, fecha: Timestamp.fromDate(ahora) },
    xp: 0,
    resumen: {},
    ultimoAcceso: Timestamp.fromDate(ahora),
    retirado: false,
    creado: Timestamp.fromDate(ahora),
  };
  return { ...doc, uid: 'vista-previa' };
}

/**
 * Almacén en memoria: sin progreso guardado, encuentros con el código «VISTA»
 * y la configuración real del estudio (solo lectura). `transaccion` descarta
 * todas las escrituras.
 */
export function almacenMemoria(aula: Aula, usuario: Usuario): Almacen {
  const real = almacenFirestore.lector();
  const lector: Lector = {
    aula: async (id) => (id === aula.id ? aula : null),
    progreso: async () => null,
    encuentro: async () => ({
      enlace: null,
      codigoHash: hashCodigoAsistencia(CODIGO_ASISTENCIA_VISTA_PREVIA),
      actualizadoPor: 'vista-previa',
      actualizado: Timestamp.now(),
    }),
    configEstudio: () => real.configEstudio(),
    limite: async () => null,
    evidencias: async () => [],
    estudiantesAula: async () => [usuario],
  };
  return {
    escribe: false,
    lector: () => lector,
    async transaccion(fn) {
      const { resultado } = await fn(lector);
      return resultado; // las escrituras se descartan
    },
  };
}

export function contextoVistaPrevia(brazo: Brazo, dia: number, ahora: Date): Ctx {
  const aula = aulaFicticia(brazo, dia, ahora);
  const usuario = usuarioFicticio(brazo, ahora);
  return { usuario, aula, brazo, dia, ahora, almacen: almacenMemoria(aula, usuario) };
}

