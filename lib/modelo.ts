/**
 * Documentos de Firestore (sección 11). Solo los usa el servidor.
 * Fuera de `identidades` no hay correos ni nombres: solo el código G-XXXXX.
 */
import type { Timestamp } from 'firebase-admin/firestore';
import type { Brazo, Equipo, ProgresoResumen, Rol } from './juego';

export const COL = {
  usuarios: 'usuarios',
  identidades: 'identidades',
  codigosParticipante: 'codigosParticipante',
  codigosUnion: 'codigosUnion',
  aulas: 'aulas',
  encuentros: 'encuentros', // subcolección de aulas
  progreso: 'progreso',
  actividades: 'actividades', // subcolección de progreso
  evidencias: 'evidencias',
  eventos: 'eventos',
  config: 'config',
  limites: 'limites',
} as const;

export interface UsuarioDoc {
  codigo: string | null; // G-XXXXX (lo recibe toda cuenta al crearse; solo se muestra a estudiantes)
  rol: Rol;
  aulaId: string | null;
  brazo: Brazo | null;
  equipo: Equipo | null;
  aulasPromotor: string[]; // solo promotor
  avatar: string | null;
  consentimiento: { version: string; fecha: Timestamp } | null;
  xp: number;
  /**
   * Resumen del progreso por actividad (copia compacta de progreso/{uid}/actividades).
   * Permite armar Inicio con una sola lectura. Se actualiza en la misma transacción.
   */
  resumen?: Record<string, ResumenActividad>;
  /** Días del estudio (1…7) con al menos un evento respuesta, completar o evidencia_enviada (dosis, H3). */
  diasActivos?: number[];
  /** Días del estudio en que completó al menos un reto (para la racha). */
  diasConReto?: number[];
  ultimoAcceso: Timestamp | null;
  retirado: boolean;
  creado: Timestamp;
}

/** Entrada del resumen: `enviada` marca una misión de campo enviada y pendiente de revisión. */
export interface ResumenActividad extends ProgresoResumen {
  enviada?: boolean;
}

/** SOLO servidor; nunca en exportaciones ni en la interfaz (salvo PA4). */
export interface IdentidadDoc {
  email: string;
  nombreGoogle: string | null;
  creado: Timestamp;
  ultimoIngreso: Timestamp;
}

export interface AulaDoc {
  nombre: string;
  facultad: string;
  brazo: Brazo;
  fechaInicio: string; // AAAA-MM-DD: día 1 del estudio (decisión 7)
  capacidad: number;
  inscritos: number;
  equipos: Record<Equipo, number>;
  codigoUnion: string;
  activa: boolean;
  prueba: boolean;
  enlaceGrupo: string | null;
  creadoPor: string;
  creado: Timestamp;
}

export type EncuentroId = 'enc-1' | 'enc-2' | 'enc-3';

export interface EncuentroDoc {
  enlace: string | null;
  codigoHash: string | null; // SHA-256 del código normalizado
  actualizadoPor: string;
  actualizado: Timestamp;
}

export interface RespuestaGuardada {
  opcion: number; // índice ORIGINAL de la opción en el contenido
  correcta: boolean;
  en: Timestamp;
}

export interface ProgresoDoc {
  estado: 'en_curso' | 'completada';
  xp: number;
  puntaje?: number;
  max?: number;
  correctas?: number;
  respuestas: Record<string, RespuestaGuardada>;
  opcion?: number;
  responsable?: boolean;
  completadaEn: Timestamp | null;
  validadoPor?: string;
  /** Misión de campo enviada y en revisión (o devuelta, si es false). */
  enviada?: boolean;
}

export type EstadoEvidencia = 'pendiente' | 'aprobada' | 'devuelta';

export interface EvidenciaDoc {
  uid: string;
  codigo: string;
  aulaId: string;
  equipo: Equipo | null;
  misionId: string;
  campos: Record<string, string | number>;
  estado: EstadoEvidencia;
  comentario: string | null;
  validadoPor: string | null;
  validadoEn: Timestamp | null;
  creado: Timestamp;
}

export const TIPOS_EVENTO = [
  'sesion',
  'consentimiento',
  'unirse_aula',
  'avatar',
  'ver_modulo',
  'ver_item',
  'respuesta',
  'practica',
  'completar',
  'abrir_enlace',
  'abrir_evaluacion',
  'asistencia_intento',
  'evidencia_enviada',
  'evidencia_aprobada',
  'evidencia_devuelta',
  'equipo_cambiado',
  'aula_movida',
  'retirado',
  'consulta_identidad',
  'rol_cambiado',
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** Solo se agregan; nunca se modifican. */
export interface EventoDoc {
  ts: Timestamp;
  uid: string;
  codigo: string | null;
  aulaId: string | null;
  brazo: Brazo | null;
  equipo: Equipo | null;
  rol: Rol;
  /** Día del estudio del aula (1 = fechaInicio), o null sin aula. */
  dia: number | null;
  tipo: TipoEvento;
  modulo?: string;
  actividadId?: string;
  pregunta?: string;
  opcion?: number;
  correcta?: boolean;
  puntaje?: number;
  max?: number;
  xp?: number;
  detalle?: string;
}

/** config/sistema: reserva del primer admin (decisión 6). */
export interface SistemaDoc {
  primerAdmin: string; // uid
  en: Timestamp;
}

export interface ConfigEstudioDoc {
  enlaces: {
    o1: string | null;
    o2: string | null;
    satisfaccion: string | null;
    o3: string | null;
    servicioMedico: string | null;
  };
  actualizadoPor: string | null;
  actualizado: Timestamp | null;
}

export interface LimiteDoc {
  /** Inicio de la ventana de una hora y número de intentos fallidos en ella, por clave. */
  ventanas: Record<string, { desde: Timestamp; intentos: number }>;
}
