import { beforeEach, describe, expect, it } from 'vitest';
import { POST as postSesion } from '@/app/api/sesion/route';
import { POST as postConsentimiento } from '@/app/api/consentimiento/route';
import { POST as postUnirse } from '@/app/api/aulas/unirse/route';
import { PATCH as patchPerfil } from '@/app/api/perfil/route';
import { GET as getYo } from '@/app/api/yo/route';
import { GET as getModulo } from '@/app/api/modulos/[id]/route';
import { GET as getActividad } from '@/app/api/actividades/[id]/route';
import { POST as postResponder } from '@/app/api/actividades/[id]/responder/route';
import { POST as postCompletar } from '@/app/api/actividades/[id]/completar/route';
import { POST as postAsistencia } from '@/app/api/actividades/[id]/asistencia/route';
import { POST as postEvidencia } from '@/app/api/evidencias/route';
import { GET as getRanking } from '@/app/api/ranking/route';
import { POST as postEvento } from '@/app/api/eventos/route';
import { catalogo, configJuego } from '@/lib/contenido';
import { db } from '@/lib/firebase-admin';
import { permutacion } from '@/lib/juego';
import { COL } from '@/lib/modelo';
import { hashCodigoAsistencia } from '@/lib/servicios/participante';
import { correo, crearAula, fechaInicioDia, limpiar, llamar, tokenGoogle, volcado } from './ayuda';

const VERSION = configJuego().consentimiento.version;

async function estudianteEn(codigoAula: string) {
  const email = correo('est');
  const token = await tokenGoogle(email);
  await llamar(postSesion, { token });
  await llamar(postConsentimiento, { token, cuerpo: { version: VERSION } });
  const u = await llamar(postUnirse, { token, cuerpo: { codigo: codigoAula } });
  expect(u.status).toBe(200);
  await llamar(patchPerfil, { token, metodo: 'PATCH', cuerpo: { avatar: configJuego().avatares[0] } });
  const uid = (await db().collection(COL.identidades).where('email', '==', email).get()).docs[0]!.id;
  return { token, uid, equipo: u.datos.equipo as string | null };
}

const get = (h: typeof getActividad, token: string, id: string) =>
  llamar(h as never, { token, metodo: 'GET', params: { id } });
const responder = (token: string, id: string, cuerpo: Record<string, unknown>) =>
  llamar(postResponder, { token, params: { id }, cuerpo });
const completar = (token: string, id: string) => llamar(postCompletar, { token, params: { id } });
const yo = async (token: string) => (await llamar(getYo, { token, metodo: 'GET' })).datos;
const xpDe = async (uid: string) => (await db().collection(COL.usuarios).doc(uid).get()).data()!.xp as number;

/** Posición mostrada de la opción correcta / incorrecta de una pregunta de reto. */
function posicionReto(uid: string, retoId: string, k: number, acertar: boolean) {
  const reto = catalogo().actividades.get(retoId)!.actividad;
  if (reto.tipo !== 'reto') throw new Error('tipo');
  const p = reto.preguntas[k]!;
  const perm = permutacion(p.opciones.length, `${uid}|${retoId}|p${k}`);
  const original = acertar ? p.correcta : (p.correcta + 1) % p.opciones.length;
  return perm.indexOf(original);
}

function posicionCaso(uid: string, casoId: string, responsable: boolean) {
  const caso = catalogo().actividades.get(casoId)!.actividad;
  if (caso.tipo !== 'caso') throw new Error('tipo');
  const perm = permutacion(caso.opciones.length, `${uid}|${casoId}`);
  return perm.indexOf(caso.opciones.findIndex((o) => o.responsable === responsable));
}

function posicionQuiz(uid: string, casoId: string, acertar: boolean) {
  const caso = catalogo().mision1.casos.find((c) => c.id === casoId)!;
  const perm = permutacion(caso.opciones.length, `${uid}|mision1|${casoId}`);
  return perm.indexOf(caso.opciones.findIndex((o) => o.correcta === acertar));
}

beforeEach(async () => {
  await limpiar();
  await llamar(postSesion, { token: await tokenGoogle(correo('admin')) }); // primer admin
  await crearAula('exp', { brazo: 'experimental', codigoUnion: 'EXPE26', fechaInicio: fechaInicioDia(3) });
  await crearAula('ctl', { brazo: 'control', codigoUnion: 'CTRL26', fechaInicio: fechaInicioDia(3) });
});

describe('apertura en 1 semana (decisión 7, criterio 5)', () => {
  it('el día 3 está todo abierto salvo O2, satisfacción y O3', async () => {
    const e = await estudianteEn('EXPE26');
    const d = await yo(e.token);
    expect(d.dia).toBe(3);
    expect(d.fase).toBe('Día 3 de 7');
    const abiertos = d.modulos.filter((m: { estado: { tipo: string } }) => m.estado.tipo !== 'cerrado').map((m: { id: string }) => m.id);
    expect(abiertos.sort()).toEqual(['botica', 'caso', 'conectar', 'encuentros', 'evaluaciones', 'lab', 'misiones', 'retos', 'voces']);
    expect(d.modulos.find((m: { id: string }) => m.id === 'misiones').estado.texto).toBe('3 pendientes');
    // Retos cuenta el microcaso dentro de su reto; el podcast sin enlace y las evaluaciones sin formulario no cuentan.
    expect(d.modulos.find((m: { id: string }) => m.id === 'retos').estado.texto).toBe('12 pendientes');
    expect(d.modulos.find((m: { id: string }) => m.id === 'retos').titulo).toBe('Retos');
    expect(d.modulos.find((m: { id: string }) => m.id === 'voces').estado.tipo).toBe('abierto');
    expect(d.tarjetaSemana).toBe('Tu siguiente misión');
    expect(d.semanal.titulo).toBe('Misión 1 – Detectives del Antibiótico');
  });

  it('un reto con el microcaso pendiente sigue pendiente, y la misión de la semana lleva al reto', async () => {
    const e = await estudianteEn('EXPE26');
    for (const id of ['mision1', 'lec-virus-bacterias', 'lec-mitos', 'lec-mecanismos', 'lec-una-salud', 'caso-botica-1', 'caso-botica-2', 'caso-botica-3', 'cap-1', 'cap-2', 'cap-3']) {
      await db().collection(COL.usuarios).doc(e.uid).update({ [`resumen.${id}`]: { estado: 'completada' } });
    }
    await db().collection(COL.usuarios).doc(e.uid).update({ 'resumen.reto-s5': { estado: 'completada' } });
    const d = await yo(e.token);
    expect(d.semanal).toMatchObject({ titulo: catalogo().actividades.get('reto-s5')!.actividad.titulo, enlace: '/actividad/reto-s5' });
  });

  it('antes del inicio (día 0) todo está cerrado', async () => {
    await db().collection(COL.aulas).doc('exp').update({ fechaInicio: fechaInicioDia(0) });
    const e = await estudianteEn('EXPE26');
    const d = await yo(e.token);
    expect(d.modulos.every((m: { estado: { tipo: string } }) => m.estado.tipo === 'cerrado')).toBe(true);
    expect(d.semanal).toMatchObject({ tipo: 'antes_inicio', texto: 'El estudio aún no empieza' });
    expect(d.fase).toBe('Antes del inicio');
    expect((await get(getActividad, e.token, 'lec-mitos')).status).toBe(403);
  });

  it('pedir una actividad cerrada por URL devuelve 403', async () => {
    const e = await estudianteEn('EXPE26');
    for (const id of ['eval-o2', 'eval-sat', 'eval-o3']) {
      const r = await get(getActividad, e.token, id);
      expect(r.status, id).toBe(403);
      expect(r.datos.error).toBe('actividad_cerrada');
    }
    expect((await completar(e.token, 'eval-o3')).status).toBe(403);
    expect((await get(getActividad, e.token, 'reto-s16')).status).toBe(200);
  });
});

describe('sin respuestas en el navegador (criterio 6)', () => {
  it('GET /api/actividades/* no trae correcta, responsable ni feedback sin responder', async () => {
    const e = await estudianteEn('EXPE26');
    for (const id of ['caso-botica-1', 'reto-s6', 'mision1', 'caso-s6']) {
      const r = await get(getActividad, e.token, id);
      expect(r.status, id).toBe(200);
      expect(JSON.stringify(r.datos), id).not.toMatch(/"(correcta|responsable|feedback|opcionCorrecta)"\s*:/);
    }
  });
});

describe('caso de la Botica', () => {
  it('una sola elección: +15 si es responsable y al volver se ve el resultado guardado', async () => {
    const e = await estudianteEn('EXPE26');
    const r = await responder(e.token, 'caso-botica-1', { opcion: posicionCaso(e.uid, 'caso-botica-1', true) });
    expect(r.datos).toMatchObject({ correcta: true, completada: true, xpOtorgado: 15 });
    expect(r.datos.feedback).toMatch(/^¡Decisión de Guardiana!/);
    const otra = await responder(e.token, 'caso-botica-1', { opcion: posicionCaso(e.uid, 'caso-botica-1', false) });
    expect(otra.datos).toMatchObject({ yaRespondida: true, correcta: true, xpOtorgado: 0 });
    expect(await xpDe(e.uid)).toBe(15);
    const v = await get(getActividad, e.token, 'caso-botica-1');
    expect(v.datos.actividad.respuesta.responsable).toBe(true);
  });

  it('un error muestra la explicación y no resta', async () => {
    const e = await estudianteEn('EXPE26');
    const r = await responder(e.token, 'caso-botica-2', { opcion: posicionCaso(e.uid, 'caso-botica-2', false) });
    expect(r.datos).toMatchObject({ correcta: false, xpOtorgado: 0 });
    expect(r.datos.feedbackCorrecta).toBeTruthy();
    expect(await xpDe(e.uid)).toBe(0);
  });
});

describe('Misión 1 (criterio 7)', () => {
  async function jugar(token: string, uid: string, aciertos: number, desde = 0) {
    const v = (await get(getActividad, token, 'mision1')).datos.actividad;
    let ultimo;
    for (let i = desde; i < v.casos.length; i++) {
      const c = v.casos[i];
      ultimo = await responder(token, 'mision1', { pregunta: c.id, opcion: posicionQuiz(uid, c.id, i < aciertos) });
      expect(ultimo.status).toBe(200);
    }
    return ultimo!;
  }

  it('orden estable, se retoma tras recargar, XP = round(aciertos/10 × 40) una sola vez', async () => {
    const e = await estudianteEn('EXPE26');
    const a = (await get(getActividad, e.token, 'mision1')).datos.actividad;
    const b = (await get(getActividad, e.token, 'mision1')).datos.actividad;
    expect(a.casos.map((c: { id: string }) => c.id)).toEqual(b.casos.map((c: { id: string }) => c.id));
    expect(a.casos).toHaveLength(10);

    // Responde 3 y «recarga»
    for (let i = 0; i < 3; i++) {
      await responder(e.token, 'mision1', { pregunta: a.casos[i].id, opcion: posicionQuiz(e.uid, a.casos[i].id, true) });
    }
    const tras = (await get(getActividad, e.token, 'mision1')).datos.actividad;
    expect(tras.estado).toBe('en_curso');
    expect(tras.casos.filter((c: { respuesta: unknown }) => c.respuesta)).toHaveLength(3);
    expect(tras.casos[3].respuesta).toBeNull();

    // No se puede saltar casos
    const saltar = await responder(e.token, 'mision1', { pregunta: a.casos[5].id, opcion: 0 });
    expect(saltar.datos.error).toBe('orden_invalido');

    const fin = await jugar(e.token, e.uid, 7, 3);
    expect(fin.datos).toMatchObject({ completada: true, xpOtorgado: 28 });
    expect(fin.datos.resultado).toMatchObject({ aciertos: 7, total: 10, detective: false });
    expect(await xpDe(e.uid)).toBe(28);

    // La práctica no cambia el XP ni el resultado guardado
    const p = await responder(e.token, 'mision1', { pregunta: a.casos[0].id, opcion: 0, modo: 'practica' });
    expect(p.datos).toMatchObject({ practica: true, xpOtorgado: 0 });
    expect((await responder(e.token, 'mision1', { pregunta: a.casos[0].id, opcion: 0 })).datos.error).toBe('ya_completada');
    expect(await xpDe(e.uid)).toBe(28);
    const v = (await get(getActividad, e.token, 'mision1')).datos.actividad;
    expect(v.resultado.aciertos).toBe(7);
    const ins = (await yo(e.token)).juego.insignias;
    expect(ins.find((i: { id: string }) => i.id === 'explorador').ganada).toBe(true);
    expect(ins.find((i: { id: string }) => i.id === 'detective').ganada).toBe(false);
  });

  it('con 8/10 aparece la insignia Detective', async () => {
    const e = await estudianteEn('EXPE26');
    const fin = await jugar(e.token, e.uid, 8);
    expect(fin.datos.xpOtorgado).toBe(32);
    expect(fin.datos.resultado.detective).toBe(true);
    const ins = (await yo(e.token)).juego.insignias;
    expect(ins.find((i: { id: string }) => i.id === 'detective').ganada).toBe(true);
  });

  it('la práctica no está disponible antes de completar', async () => {
    const e = await estudianteEn('EXPE26');
    const c = (await get(getActividad, e.token, 'mision1')).datos.actividad.casos[0];
    expect((await responder(e.token, 'mision1', { pregunta: c.id, opcion: 0, modo: 'practica' })).datos.error).toBe(
      'practica_no_disponible',
    );
  });
});

describe('reto (criterio 8)', () => {
  it('retroalimentación inmediata; 10 × aciertos + 10 si reto-s5 está completo; microcaso +15', async () => {
    const e = await estudianteEn('EXPE26');
    // reto-s5 completo (2 aciertos = 20 XP, sin bono: no hay reto-s4)
    for (let k = 0; k < 3; k++) await responder(e.token, 'reto-s5', { pregunta: `p${k}`, opcion: posicionReto(e.uid, 'reto-s5', k, k < 2) });
    expect(await xpDe(e.uid)).toBe(20);

    const r0 = await responder(e.token, 'reto-s6', { pregunta: 'p0', opcion: posicionReto(e.uid, 'reto-s6', 0, true) });
    expect(r0.datos).toMatchObject({ correcta: true, veredicto: '¡Correcto!', completada: false, xpOtorgado: 0 });
    expect(r0.datos.feedback).toBeTruthy();
    const r1 = await responder(e.token, 'reto-s6', { pregunta: 'p1', opcion: posicionReto(e.uid, 'reto-s6', 1, false) });
    expect(r1.datos).toMatchObject({ correcta: false, veredicto: 'No exactamente.' });
    const r2 = await responder(e.token, 'reto-s6', { pregunta: 'p2', opcion: posicionReto(e.uid, 'reto-s6', 2, true) });
    expect(r2.datos).toMatchObject({ completada: true, xpOtorgado: 30 }); // 2 × 10 + 10 de racha
    expect(await xpDe(e.uid)).toBe(50);

    const m = await responder(e.token, 'caso-s6', { opcion: posicionCaso(e.uid, 'caso-s6', true) });
    expect(m.datos.xpOtorgado).toBe(15);
    expect(await xpDe(e.uid)).toBe(65);
    expect((await yo(e.token)).juego.racha).toBe(1); // dos retos el mismo día = 1 día de racha
  });
});

describe('grupo control (criterio 9)', () => {
  it('no recibe elementos de juego, no ve Misión 1 ni Caso ni Misiones, y no tiene ranking', async () => {
    const e = await estudianteEn('CTRL26');
    const d = await yo(e.token);
    expect(d.juego).toBeNull();
    expect(d.tarjetaSemana).toBe('Siguiente tema');
    const ids = d.modulos.map((m: { id: string }) => m.id);
    expect(ids).not.toContain('caso');
    expect(ids).not.toContain('misiones');
    expect(d.modulos.find((m: { id: string }) => m.id === 'lab').titulo).toBe('Lecturas');
    expect(d.modulos.find((m: { id: string }) => m.id === 'botica').titulo).toBe('Casos comentados');
    expect(d.modulos.find((m: { id: string }) => m.id === 'retos').grupo).toBe('Actividades');
    expect(JSON.stringify(d)).not.toMatch(/"xp"|"racha"|"insignias"|"equipo"|"nivel"/);
    expect((await get(getActividad, e.token, 'mision1')).status).toBe(404);
    expect((await get(getActividad, e.token, 'cap-1')).status).toBe(404);
    expect((await llamar(getRanking, { token: e.token, metodo: 'GET' })).status).toBe(403);
  });

  it('lee los casos comentados sin frases de juego y sus actividades completadas se registran', async () => {
    const e = await estudianteEn('CTRL26');
    const v = (await get(getActividad, e.token, 'caso-botica-1')).datos.actividad;
    expect(v.modo).toBe('comentado');
    expect(v.explicacion.startsWith('¡')).toBe(false);
    expect((await responder(e.token, 'caso-botica-1', { opcion: 0 })).datos.error).toBe('solo_experimental');

    expect((await completar(e.token, 'caso-botica-1')).datos).toMatchObject({ completada: true, xpOtorgado: 0 });
    expect((await completar(e.token, 'reto-s6')).datos).toMatchObject({ completada: true, xpOtorgado: 0 });
    const resumen = (await db().collection(COL.usuarios).doc(e.uid).get()).data()!.resumen;
    expect(Object.keys(resumen).sort()).toEqual(['caso-botica-1', 'caso-s6', 'reto-s6']);
    expect(await xpDe(e.uid)).toBe(0);
    const ev = await db().collection(COL.eventos).where('uid', '==', e.uid).where('tipo', '==', 'completar').get();
    expect(ev.size).toBe(3);
    expect(ev.docs.every((d) => d.data().brazo === 'control' && d.data().dia === 3)).toBe(true);
  });
});

describe('lecturas, podcast y evaluaciones', () => {
  it('marcar como leído registra la actividad sin XP; repetirlo no cambia nada', async () => {
    const e = await estudianteEn('EXPE26');
    expect((await completar(e.token, 'lec-mitos')).datos).toMatchObject({ completada: true, xpOtorgado: 0 });
    expect((await completar(e.token, 'lec-mitos')).datos.xpOtorgado).toBe(0);
    expect((await get(getActividad, e.token, 'lec-mitos')).datos.actividad.completada).toBe(true);
  });

  it('un podcast sin enlace no se puede marcar', async () => {
    const e = await estudianteEn('EXPE26');
    expect((await completar(e.token, 'pod-1')).datos.error).toBe('no_disponible');
  });

  it('evaluación: enlace con {codigo} reemplazado y +10 por «Ya lo respondí»', async () => {
    await db().collection(COL.config).doc('estudio').set({
      enlaces: { o1: 'https://forms.example/o1?entry.1={codigo}', o2: null, satisfaccion: null, o3: null, servicioMedico: null },
    });
    const e = await estudianteEn('EXPE26');
    const v = (await get(getActividad, e.token, 'eval-o1')).datos.actividad;
    expect(v.enlace).toBe(`https://forms.example/o1?entry.1=${v.codigo}`);
    expect((await completar(e.token, 'eval-o1')).datos.xpOtorgado).toBe(10);
    expect((await completar(e.token, 'eval-o2')).datos.error).toBe('actividad_cerrada'); // O2 abre el día 7
  });
});

describe('encuentro (criterio 11)', () => {
  it('falla con «otro», acierta con «FLEMING6 » y suma +20 una sola vez', async () => {
    await db().collection(COL.aulas).doc('exp').collection(COL.encuentros).doc('enc-1').set({
      enlace: 'https://meet.example/x',
      codigoHash: hashCodigoAsistencia('fleming6'),
      actualizadoPor: 'prueba',
      actualizado: new Date(),
    });
    const e = await estudianteEn('EXPE26');
    const mal = await llamar(postAsistencia, { token: e.token, params: { id: 'enc-1' }, cuerpo: { codigo: 'otro' } });
    expect(mal.datos.error).toBe('codigo_asistencia_incorrecto');
    const bien = await llamar(postAsistencia, { token: e.token, params: { id: 'enc-1' }, cuerpo: { codigo: 'FLEMING6 ' } });
    expect(bien.datos).toMatchObject({ completada: true, xpOtorgado: 20 });
    const otra = await llamar(postAsistencia, { token: e.token, params: { id: 'enc-1' }, cuerpo: { codigo: 'FLEMING6' } });
    expect(otra.datos.xpOtorgado).toBe(0);
    expect(await xpDe(e.uid)).toBe(20);
    const ins = (await yo(e.token)).juego.insignias;
    expect(ins.find((i: { id: string }) => i.id === 'fleming').ganada).toBe(true);
  });

  it('bloquea tras 10 códigos incorrectos en una hora', async () => {
    await db().collection(COL.aulas).doc('exp').collection(COL.encuentros).doc('enc-1').set({
      enlace: null,
      codigoHash: hashCodigoAsistencia('fleming6'),
      actualizadoPor: 'prueba',
      actualizado: new Date(),
    });
    const e = await estudianteEn('EXPE26');
    for (let i = 0; i < 10; i++) await llamar(postAsistencia, { token: e.token, params: { id: 'enc-1' }, cuerpo: { codigo: `x${i}` } });
    const r = await llamar(postAsistencia, { token: e.token, params: { id: 'enc-1' }, cuerpo: { codigo: 'fleming6' } });
    expect(r.datos.error).toBe('demasiados_intentos');
  });
});

describe('misión de campo (criterio 10, parte del participante)', () => {
  it('se envía y queda pendiente; no se puede reenviar mientras está pendiente', async () => {
    const e = await estudianteEn('EXPE26');
    const campos = { hayAntibioticos: 'Sí', cuantos: '2', accion: 'Pregunté cómo desecharlos', comentario: 'Aprendí algo.' };
    expect((await llamar(postEvidencia, { token: e.token, cuerpo: { misionId: 'mision-botiquin', campos: { ...campos, accion: 'Inventada' } } })).datos.error).toBe('campos_invalidos');
    const r = await llamar(postEvidencia, { token: e.token, cuerpo: { misionId: 'mision-botiquin', campos } });
    expect(r.datos.estado).toBe('pendiente');
    expect((await llamar(postEvidencia, { token: e.token, cuerpo: { misionId: 'mision-botiquin', campos } })).datos.error).toBe('ya_enviada');
    const v = (await get(getActividad, e.token, 'mision-botiquin')).datos.actividad;
    expect(v).toMatchObject({ estado: 'pendiente', valores: { cuantos: 2 } });
    const ev = (await db().collection(COL.evidencias).get()).docs[0]!.data();
    expect(ev).toMatchObject({ estado: 'pendiente', aulaId: 'exp', misionId: 'mision-botiquin', equipo: e.equipo });
    expect(await xpDe(e.uid)).toBe(0);
    // Ya no cuenta como pendiente en Inicio (quedan las otras 2 misiones)
    const mod = (await yo(e.token)).modulos.find((m: { id: string }) => m.id === 'misiones');
    expect(mod.estado.texto).toBe('2 pendientes');
  });
});

describe('ranking por equipos', () => {
  it('promedio por equipo, sin retirados ni datos individuales', async () => {
    const a = await estudianteEn('EXPE26'); // E1
    const b = await estudianteEn('EXPE26'); // E2
    await db().collection(COL.usuarios).doc(a.uid).update({ xp: 100 });
    await db().collection(COL.usuarios).doc(b.uid).update({ xp: 300 });
    let r = await llamar(getRanking, { token: a.token, metodo: 'GET' });
    expect(r.datos.equipos).toEqual([
      { equipo: 'E2', promedio: 300, integrantes: 1 },
      { equipo: 'E1', promedio: 100, integrantes: 1 },
    ]);
    expect(r.datos.miEquipo).toBe('E1');
    await db().collection(COL.usuarios).doc(b.uid).update({ retirado: true });
    r = await llamar(getRanking, { token: a.token, metodo: 'GET' });
    expect(r.datos.equipos).toEqual([{ equipo: 'E1', promedio: 100, integrantes: 1 }]);
  });
});

describe('módulos y eventos', () => {
  it('el módulo de retos no lista los microcasos aparte y marca las cerradas', async () => {
    const e = await estudianteEn('EXPE26');
    const r = await llamar(getModulo, { token: e.token, metodo: 'GET', params: { id: 'retos' } });
    const ids = r.datos.actividades.map((a: { id: string }) => a.id);
    expect(ids.some((x: string) => x.startsWith('caso-s'))).toBe(false);
    expect(r.datos.actividades.find((a: { id: string }) => a.id === 'reto-s16')).toMatchObject({ estado: 'abierta' });
    const ev = await llamar(getModulo, { token: e.token, metodo: 'GET', params: { id: 'evaluaciones' } });
    expect(ev.datos.actividades.find((a: { id: string }) => a.id === 'eval-o3')).toMatchObject({ estado: 'cerrada' });
    expect((await llamar(getModulo, { token: e.token, metodo: 'GET', params: { id: 'nada' } })).status).toBe(404);
  });

  it('registra ver_modulo con aula, brazo, equipo y día; rechaza actividades cerradas', async () => {
    const e = await estudianteEn('EXPE26');
    expect((await llamar(postEvento, { token: e.token, cuerpo: { tipo: 'ver_modulo', modulo: 'lab' } })).status).toBe(200);
    expect((await llamar(postEvento, { token: e.token, cuerpo: { tipo: 'ver_item', actividadId: 'eval-o3' } })).status).toBe(403);
    const ev = (await db().collection(COL.eventos).where('tipo', '==', 'ver_modulo').get()).docs[0]!.data();
    expect(ev).toMatchObject({ modulo: 'lab', aulaId: 'exp', brazo: 'experimental', equipo: 'E1', dia: 3 });
  });

  it('un estudiante sin aula recibe 409 con el siguiente paso', async () => {
    const token = await tokenGoogle(correo());
    await llamar(postSesion, { token });
    const r = await llamar(getYo, { token, metodo: 'GET' });
    expect(r.status).toBe(409);
    expect(r.datos.siguientePaso).toBe('/consentimiento');
  });

  it('el investigador (y el resto del personal) no puede resolver actividades', async () => {
    const e = await estudianteEn('EXPE26');
    await db().collection(COL.usuarios).doc(e.uid).update({ rol: 'investigador', aulaId: null, brazo: null, equipo: null });
    for (const r of [
      await llamar(getYo, { token: e.token, metodo: 'GET' }),
      await responder(e.token, 'caso-botica-1', { opcion: 0 }),
      await completar(e.token, 'lec-mitos'),
    ]) {
      expect(r.status).toBe(403);
      expect(r.datos.error).toBe('rol_no_permitido');
    }
    const docs = await volcado();
    expect(docs.filter((d) => d.ruta.startsWith('usuarios/') && d.datos.rol === 'admin')).toHaveLength(1);
  });
});
