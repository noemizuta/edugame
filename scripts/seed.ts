/**
 * Datos de prueba para los EMULADORES de Firebase (nunca para producción).
 *
 *   firebase emulators:start --only auth,firestore     (en otra terminal)
 *   npm run seed
 *
 * Crea (sección 14):
 *  - 1 admin, 1 investigador y 2 promotores (decisión 6);
 *  - 2 aulas (experimental EXPE26 y control CTRL26) que empezaron hace 5 días: hoy es el día 6 de 7 (decisión 7);
 *  - 8 participantes con progreso variado y últimos accesos de hace 0, 1, 3 y 5 días (verde, verde, amarillo, rojo);
 *  - 1 evidencia pendiente;
 *  - encuentro 1 con el código de asistencia FLEMING6 y enlaces de ejemplo para O1 y O2.
 * Borra antes todo lo que haya en los emuladores.
 */
import { Timestamp } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { catalogo } from '@/lib/contenido';
import type { ActividadCaso, ActividadReto } from '@/lib/contenido';
import { adminAuth, db } from '@/lib/firebase-admin';
import {
  type Brazo,
  type Equipo,
  EQUIPOS,
  fechaLima,
  generarCodigoParticipante,
  esEventoActivo,
  idReto,
  permutacion,
  prng,
  diaEstudio,
  sumarDias,
  xpQuiz,
} from '@/lib/juego';
import {
  type AulaDoc,
  COL,
  type ConfigEstudioDoc,
  type EventoDoc,
  type EvidenciaDoc,
  type IdentidadDoc,
  type ProgresoDoc,
  type SistemaDoc,
  type UsuarioDoc,
} from '@/lib/modelo';

// ───────── Solo emuladores ─────────
process.env.USE_FIREBASE_EMULATOR = 'true';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
const PROYECTO = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-edugame';
for (const h of [process.env.FIRESTORE_EMULATOR_HOST, process.env.FIREBASE_AUTH_EMULATOR_HOST]) {
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(h ?? '')) {
    throw new Error(`El seed solo corre contra emuladores locales (host: ${h})`);
  }
}

const DIA = 86_400_000;
const ahora = new Date();
const hace = (dias: number) => new Date(ahora.getTime() - dias * DIA);
const ts = (d: Date) => Timestamp.fromDate(d);
const rnd = prng(20261114);

const { config, mision1, actividades } = catalogo();

/** El aula empezó hace 5 días: hoy es el día 6 del estudio (O2, satisfacción y O3 se abren el día 7). */
const FECHA_INICIO = sumarDias(fechaLima(ahora), -5);

/** Instante a las 10:00 de Lima del día N del estudio (día 1 = FECHA_INICIO), sin pasar de `tope`. */
function momento(dia: number, tope: Date): Date {
  const d = new Date(`${sumarDias(FECHA_INICIO, dia - 1)}T10:00:00-05:00`);
  return d.getTime() < tope.getTime() ? d : new Date(tope.getTime() - 5 * 60_000);
}

// ───────── Limpieza ─────────
async function limpiarEmuladores() {
  const fs = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROYECTO}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  const au = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROYECTO}/accounts`, {
    method: 'DELETE',
  });
  if (!fs.ok || !au.ok) throw new Error('No se pudieron limpiar los emuladores. ¿Están encendidos?');
}

// ───────── Personas ─────────
async function crearCuenta(uid: string, email: string, nombre: string) {
  await adminAuth().createUser({ uid, email, displayName: nombre, emailVerified: true });
  // Proveedor google.com: la cuenta aparece en la ventana «Sign-in with Google.com» del emulador.
  await adminAuth().updateUser(uid, { providerToLink: { providerId: 'google.com', uid: `google-${uid}`, email, displayName: nombre } });
  const identidad: IdentidadDoc = { email, nombreGoogle: nombre, creado: ts(hace(60)), ultimoIngreso: ts(ahora) };
  await db().collection(COL.identidades).doc(uid).set(identidad);
}

function usuarioBase(rol: UsuarioDoc['rol']): UsuarioDoc {
  return {
    codigo: null,
    rol,
    aulaId: null,
    brazo: null,
    equipo: null,
    aulasPromotor: [],
    avatar: null,
    consentimiento: null,
    xp: 0,
    ultimoAcceso: ts(ahora),
    retirado: false,
    creado: ts(hace(60)),
  };
}

const codigosUsados = new Set<string>();
function nuevoCodigo(): string {
  let c: string;
  do c = generarCodigoParticipante(rnd);
  while (codigosUsados.has(c));
  codigosUsados.add(c);
  return c;
}

/** Personal: toda cuenta recibe su código al crearse (decisión 6), aunque solo se muestra a estudiantes. */
async function crearPersonal(uid: string, email: string, nombre: string, rol: Exclude<UsuarioDoc['rol'], 'estudiante'>, aulas: string[] = []) {
  await crearCuenta(uid, email, nombre);
  const codigo = nuevoCodigo();
  await db().collection(COL.usuarios).doc(uid).set({ ...usuarioBase(rol), codigo, aulasPromotor: aulas });
  await db().collection(COL.codigosParticipante).doc(codigo).set({ uid });
}

// ───────── Progreso planificado ─────────
type Plan =
  | { id: 'mision1'; dia: number; aciertos: number }
  | { id: string; dia: number; tipo: 'lectura' | 'evaluacion' }
  | { id: string; dia: number; tipo: 'caso'; responsable: boolean }
  | { id: string; dia: number; tipo: 'reto'; aciertos: number; microcaso?: boolean };

interface Participante {
  uid: string;
  brazo: Brazo;
  equipo: Equipo | null;
  accesoHaceDias: number;
  avatar: string;
  plan: Plan[];
}

const participantes: Participante[] = [
  {
    uid: 'seed-exp-1',
    brazo: 'experimental',
    equipo: 'E1',
    accesoHaceDias: 0,
    avatar: config.avatares[0]!,
    plan: [
      { id: 'eval-o1', dia: 1, tipo: 'evaluacion' },
      { id: 'mision1', dia: 1, aciertos: 8 },
      { id: 'lec-virus-bacterias', dia: 1, tipo: 'lectura' },
      { id: 'cap-1', dia: 1, tipo: 'lectura' },
      { id: 'caso-botica-1', dia: 2, tipo: 'caso', responsable: true },
      { id: 'caso-botica-2', dia: 2, tipo: 'caso', responsable: true },
      { id: 'caso-botica-3', dia: 3, tipo: 'caso', responsable: true },
      { id: 'reto-s5', dia: 3, tipo: 'reto', aciertos: 3, microcaso: true },
      { id: 'reto-s6', dia: 4, tipo: 'reto', aciertos: 3, microcaso: false },
      { id: 'reto-s7', dia: 5, tipo: 'reto', aciertos: 2 },
    ],
  },
  {
    uid: 'seed-exp-2',
    brazo: 'experimental',
    equipo: 'E2',
    accesoHaceDias: 1,
    avatar: config.avatares[1]!,
    plan: [
      { id: 'eval-o1', dia: 1, tipo: 'evaluacion' },
      { id: 'mision1', dia: 1, aciertos: 6 },
      { id: 'caso-botica-1', dia: 2, tipo: 'caso', responsable: true },
      { id: 'caso-botica-2', dia: 2, tipo: 'caso', responsable: false },
      { id: 'reto-s5', dia: 4, tipo: 'reto', aciertos: 2, microcaso: false },
    ],
  },
  {
    uid: 'seed-exp-3',
    brazo: 'experimental',
    equipo: 'E2',
    accesoHaceDias: 3,
    avatar: config.avatares[2]!,
    plan: [
      { id: 'eval-o1', dia: 1, tipo: 'evaluacion' },
      { id: 'mision1', dia: 1, aciertos: 10 },
      { id: 'lec-mitos', dia: 2, tipo: 'lectura' },
    ],
  },
  {
    uid: 'seed-exp-4',
    brazo: 'experimental',
    equipo: 'E3',
    accesoHaceDias: 5,
    avatar: config.avatares[3]!,
    plan: [{ id: 'eval-o1', dia: 1, tipo: 'evaluacion' }],
  },
  {
    uid: 'seed-exp-5',
    brazo: 'experimental',
    equipo: 'E1',
    accesoHaceDias: 0,
    avatar: config.avatares[4]!,
    plan: [],
  },
  {
    uid: 'seed-ctl-1',
    brazo: 'control',
    equipo: null,
    accesoHaceDias: 1,
    avatar: config.avatares[5]!,
    plan: [
      { id: 'eval-o1', dia: 1, tipo: 'evaluacion' },
      { id: 'lec-control-10-mitos', dia: 1, tipo: 'lectura' },
      { id: 'caso-botica-1', dia: 2, tipo: 'lectura' }, // en el control, el caso comentado se marca como leído
      { id: 'reto-s5', dia: 3, tipo: 'lectura' }, // lectura del reto: completa reto-s5 y caso-s5
      { id: 'caso-s5', dia: 3, tipo: 'lectura' },
    ],
  },
  {
    uid: 'seed-ctl-2',
    brazo: 'control',
    equipo: null,
    accesoHaceDias: 3,
    avatar: config.avatares[6]!,
    plan: [
      { id: 'eval-o1', dia: 1, tipo: 'evaluacion' },
      { id: 'lec-virus-bacterias', dia: 2, tipo: 'lectura' },
    ],
  },
  {
    uid: 'seed-ctl-3',
    brazo: 'control',
    equipo: null,
    accesoHaceDias: 5,
    avatar: config.avatares[7]!,
    plan: [],
  },
];

// ───────── Escritura ─────────
async function main() {
  console.log(`Proyecto ${PROYECTO} · emuladores ${process.env.FIRESTORE_EMULATOR_HOST} y ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  await limpiarEmuladores();
  const f = db();

  // Personal (decisión 6). El admin del seed ocupa la reserva de «primer admin».
  await crearPersonal('seed-admin', 'admin@example.com', 'Admin de prueba', 'admin');
  const sistema: SistemaDoc = { primerAdmin: 'seed-admin', en: ts(hace(60)) };
  await f.collection(COL.config).doc('sistema').set(sistema);
  await crearPersonal('seed-investigador', 'investigador@example.com', 'Investigador de prueba', 'investigador');

  const aulas: Record<Brazo, { id: string; doc: AulaDoc }> = {
    experimental: {
      id: 'aula-exp-1',
      doc: {
        nombre: 'Enfermería A (prueba)',
        facultad: 'Ciencias de la Salud',
        brazo: 'experimental',
        fechaInicio: FECHA_INICIO,
        capacidad: config.app.capacidadAula,
        inscritos: 0,
        equipos: Object.fromEntries(EQUIPOS.map((e) => [e, 0])) as Record<Equipo, number>,
        codigoUnion: 'EXPE26',
        activa: true,
        prueba: true,
        enlaceGrupo: 'https://t.me/ejemplo-grupo-aula',
        creadoPor: 'seed-admin',
        creado: ts(hace(50)),
      },
    },
    control: {
      id: 'aula-ctl-1',
      doc: {
        nombre: 'Enfermería B (prueba)',
        facultad: 'Ciencias de la Salud',
        brazo: 'control',
        fechaInicio: FECHA_INICIO,
        capacidad: config.app.capacidadAula,
        inscritos: 0,
        equipos: Object.fromEntries(EQUIPOS.map((e) => [e, 0])) as Record<Equipo, number>,
        codigoUnion: 'CTRL26',
        activa: true,
        prueba: true,
        enlaceGrupo: null,
        creadoPor: 'seed-admin',
        creado: ts(hace(50)),
      },
    },
  };

  for (const [i, brazo] of (['experimental', 'control'] as const).entries()) {
    const uid = `seed-promotor-${i + 1}`;
    await crearPersonal(uid, `promotor${i + 1}@example.com`, `Promotor ${i + 1} de prueba`, 'promotor', [aulas[brazo].id]);
  }

  // Participantes
  let n = 0;
  for (const p of participantes) {
    n++;
    const aula = aulas[p.brazo];
    const codigo = nuevoCodigo();
    const acceso = hace(p.accesoHaceDias);
    await crearCuenta(p.uid, `participante${n}@example.com`, `Participante ${n}`);

    let xpTotal = 0;
    const eventos: EventoDoc[] = [];
    const evento = (tipo: EventoDoc['tipo'], cuando: Date, extra: Partial<EventoDoc> = {}) => {
      const e: EventoDoc = {
        ts: ts(cuando),
        uid: p.uid,
        codigo,
        aulaId: aula.id,
        brazo: p.brazo,
        equipo: p.equipo,
        rol: 'estudiante',
        dia: diaEstudio(FECHA_INICIO, cuando),
        tipo,
        ...extra,
      };
      eventos.push(e);
    };

    const ingreso = momento(1, acceso);
    evento('sesion', ingreso);
    evento('consentimiento', ingreso, { detalle: `version ${config.consentimiento.version}` });
    evento('unirse_aula', ingreso);
    evento('avatar', ingreso, { detalle: p.avatar });

    const progreso: Record<string, ProgresoDoc> = {};
    const exp = p.brazo === 'experimental';
    const otorgar = (xp: number) => (exp ? xp : 0);

    for (const paso of p.plan) {
      const cuando = momento(paso.dia, acceso);
      const en = ts(cuando);
      const info = actividades.get(paso.id);
      if (!info) throw new Error(`Actividad desconocida en el seed: ${paso.id}`);
      const modulo = info.moduloId;

      if (paso.id === 'mision1' && 'aciertos' in paso) {
        const orden = permutacion(mision1.casos.length, `${p.uid}|mision1`);
        const respuestas: ProgresoDoc['respuestas'] = {};
        orden.forEach((iCaso, k) => {
          const caso = mision1.casos[iCaso]!;
          const correcta = k < paso.aciertos;
          const iCorrecta = caso.opciones.findIndex((o) => o.correcta);
          const opcion = correcta ? iCorrecta : (iCorrecta + 1) % caso.opciones.length;
          respuestas[caso.id] = { opcion, correcta, en };
          evento('respuesta', cuando, { modulo, actividadId: 'mision1', pregunta: caso.id, opcion, correcta });
        });
        const xp = otorgar(xpQuiz(paso.aciertos, mision1.casos.length, mision1.xpMaximo));
        progreso.mision1 = {
          estado: 'completada',
          xp,
          puntaje: paso.aciertos,
          max: mision1.casos.length,
          correctas: paso.aciertos,
          respuestas,
          completadaEn: en,
        };
        xpTotal += xp;
        evento('completar', cuando, { modulo, actividadId: 'mision1', puntaje: paso.aciertos, max: 10, xp });
        continue;
      }

      if (!('tipo' in paso)) continue;
      switch (paso.tipo) {
        case 'lectura': {
          progreso[paso.id] = { estado: 'completada', xp: 0, respuestas: {}, completadaEn: en };
          evento('completar', cuando, { modulo, actividadId: paso.id, xp: 0 });
          break;
        }
        case 'evaluacion': {
          const xp = otorgar(config.xp.evaluacion);
          progreso[paso.id] = { estado: 'completada', xp, respuestas: {}, completadaEn: en };
          xpTotal += xp;
          evento('abrir_evaluacion', cuando, { modulo, actividadId: paso.id });
          evento('completar', cuando, { modulo, actividadId: paso.id, xp });
          break;
        }
        case 'caso': {
          const caso = info.actividad as ActividadCaso;
          const opcion = caso.opciones.findIndex((o) => o.responsable === paso.responsable);
          const xp = otorgar(paso.responsable ? config.xp.casoResponsable : 0);
          progreso[paso.id] = {
            estado: 'completada',
            xp,
            opcion,
            responsable: paso.responsable,
            respuestas: { caso: { opcion, correcta: paso.responsable, en } },
            completadaEn: en,
          };
          xpTotal += xp;
          evento('respuesta', cuando, { modulo, actividadId: paso.id, pregunta: 'caso', opcion, correcta: paso.responsable });
          evento('completar', cuando, { modulo, actividadId: paso.id, xp });
          break;
        }
        case 'reto': {
          const reto = info.actividad as ActividadReto;
          const respuestas: ProgresoDoc['respuestas'] = {};
          reto.preguntas.forEach((q, k) => {
            const correcta = k < paso.aciertos;
            const opcion = correcta ? q.correcta : (q.correcta + 1) % q.opciones.length;
            respuestas[`p${k}`] = { opcion, correcta, en };
            evento('respuesta', cuando, { modulo, actividadId: reto.id, pregunta: `p${k}`, opcion, correcta });
          });
          const anterior = progreso[idReto(reto.semana - 1)]?.estado === 'completada';
          const xp = otorgar(paso.aciertos * config.xp.retoCorrecta + (anterior ? config.xp.rachaSemana : 0));
          progreso[reto.id] = {
            estado: 'completada',
            xp,
            puntaje: paso.aciertos,
            max: 3,
            correctas: paso.aciertos,
            respuestas,
            completadaEn: en,
          };
          xpTotal += xp;
          evento('completar', cuando, { modulo, actividadId: reto.id, puntaje: paso.aciertos, max: 3, xp });

          if (paso.microcaso !== undefined) {
            const micro = actividades.get(reto.casoId)!.actividad as ActividadCaso;
            const resp = paso.microcaso;
            const opcion = micro.opciones.findIndex((o) => o.responsable === resp);
            const xpC = otorgar(resp ? config.xp.casoResponsable : 0);
            progreso[micro.id] = {
              estado: 'completada',
              xp: xpC,
              opcion,
              responsable: resp,
              respuestas: { caso: { opcion, correcta: resp, en } },
              completadaEn: en,
            };
            xpTotal += xpC;
            evento('respuesta', cuando, { modulo, actividadId: micro.id, pregunta: 'caso', opcion, correcta: resp });
            evento('completar', cuando, { modulo, actividadId: micro.id, xp: xpC });
          }
          break;
        }
      }
    }
    evento('sesion', acceso);

    const usuario: UsuarioDoc = {
      ...usuarioBase('estudiante'),
      codigo,
      aulaId: aula.id,
      brazo: p.brazo,
      equipo: p.equipo,
      avatar: p.avatar,
      consentimiento: { version: config.consentimiento.version, fecha: ts(ingreso) },
      xp: xpTotal,
      resumen: Object.fromEntries(
        Object.entries(progreso).map(([id, d]) => [
          id,
          {
            estado: d.estado,
            ...(d.puntaje !== undefined ? { puntaje: d.puntaje } : {}),
            ...(d.max !== undefined ? { max: d.max } : {}),
            ...(d.responsable !== undefined ? { responsable: d.responsable } : {}),
          },
        ]),
      ),
      ultimoAcceso: ts(acceso),
      diasActivos: [...new Set(eventos.filter((x) => esEventoActivo(x.tipo, x.dia, 7)).map((x) => x.dia!))].sort((a, b) => a - b),
      diasConReto: [
        ...new Set(eventos.filter((x) => x.tipo === 'completar' && x.actividadId?.startsWith('reto-s')).map((x) => x.dia!)),
      ].sort((a, b) => a - b),
    };

    const lote = f.batch();
    lote.set(f.collection(COL.usuarios).doc(p.uid), usuario);
    lote.set(f.collection(COL.codigosParticipante).doc(codigo), { uid: p.uid });
    for (const [id, doc] of Object.entries(progreso)) {
      lote.set(f.collection(COL.progreso).doc(p.uid).collection(COL.actividades).doc(id), doc);
    }
    for (const e of eventos) lote.set(f.collection(COL.eventos).doc(), e);
    await lote.commit();

    aula.doc.inscritos++;
    if (p.equipo) aula.doc.equipos[p.equipo]++;
    console.log(`  ${codigo}  ${p.brazo.padEnd(12)} ${p.equipo ?? '—'}  ${String(xpTotal).padStart(3)} XP  acceso hace ${p.accesoHaceDias} d`);
  }

  // Aulas, códigos de unión y encuentros
  for (const { id, doc } of Object.values(aulas)) {
    await f.collection(COL.aulas).doc(id).set(doc);
    await f.collection(COL.codigosUnion).doc(doc.codigoUnion).set({ aulaId: id });
    for (const enc of ['enc-1', 'enc-2', 'enc-3']) {
      // Encuentro 1 con enlace y código de asistencia de prueba «FLEMING6».
      const prueba = enc === 'enc-1';
      await f.collection(COL.aulas).doc(id).collection(COL.encuentros).doc(enc).set({
        enlace: prueba ? 'https://meet.example.com/encuentro-1' : null,
        codigoHash: prueba ? createHash('sha256').update('FLEMING6').digest('hex') : null,
        actualizadoPor: 'seed',
        actualizado: ts(ahora),
      });
    }
  }

  // Evidencia pendiente (misión del botiquín)
  const autor = participantes[1]!;
  const autorDoc = (await f.collection(COL.usuarios).doc(autor.uid).get()).data() as UsuarioDoc;
  const evidencia: EvidenciaDoc = {
    uid: autor.uid,
    codigo: autorDoc.codigo!,
    aulaId: aulas.experimental.id,
    equipo: autor.equipo,
    misionId: 'mision-botiquin',
    campos: { hayAntibioticos: 'Sí', cuantos: 2, accion: 'Pregunté cómo desecharlos', comentario: 'Texto de prueba del seed.' },
    estado: 'pendiente',
    comentario: null,
    validadoPor: null,
    validadoEn: null,
    creado: ts(hace(3.1)),
  };
  await f.collection(COL.evidencias).add(evidencia);

  // Configuración del estudio (enlaces sin definir)
  const cfg: ConfigEstudioDoc = {
    // Enlaces de ejemplo (no son formularios reales).
    enlaces: {
      o1: 'https://example.com/formulario-o1?codigo={codigo}',
      o2: 'https://example.com/formulario-o2?codigo={codigo}',
      satisfaccion: null,
      o3: null,
      servicioMedico: null,
    },
    actualizadoPor: null,
    actualizado: null,
  };
  await f.collection(COL.config).doc('estudio').set(cfg);

  const dia = diaEstudio(FECHA_INICIO, ahora);
  console.log(`\nAulas: EXPE26 (experimental) y CTRL26 (control) · inicio ${FECHA_INICIO} · hoy es el día ${dia}`);
  console.log('Personal: admin@example.com, investigador@example.com, promotor1@example.com (EXPE26), promotor2@example.com (CTRL26)');
  console.log('Listo.');
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
