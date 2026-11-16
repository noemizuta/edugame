import { beforeEach, describe, expect, it } from 'vitest';
import { POST as postSesion } from '@/app/api/sesion/route';
import { POST as postConsentimiento } from '@/app/api/consentimiento/route';
import { POST as postUnirse } from '@/app/api/aulas/unirse/route';
import { PATCH as patchPerfil } from '@/app/api/perfil/route';
import { GET as getRanking } from '@/app/api/ranking/route';
import { GET as getAulasAdmin, POST as postAula } from '@/app/api/admin/aulas/route';
import { PATCH as patchAulaAdmin } from '@/app/api/admin/aulas/[id]/route';
import { PATCH as patchRol } from '@/app/api/admin/usuarios/[uid]/rol/route';
import { POST as postMover } from '@/app/api/admin/participantes/[uid]/mover/route';
import { POST as postRetirar } from '@/app/api/admin/participantes/[uid]/retirar/route';
import { GET as getConfig, PUT as putConfig } from '@/app/api/admin/config/route';
import { GET as getAulasPanel } from '@/app/api/panel/aulas/route';
import { GET as vpGet, POST as vpPost } from '@/app/api/vista-previa/[...ruta]/route';
import { catalogo, configJuego } from '@/lib/contenido';
import { db } from '@/lib/firebase-admin';
import { permutacion } from '@/lib/juego';
import { COL } from '@/lib/modelo';
import { correo, fechaInicioDia, limpiar, llamar, tokenGoogle, volcado } from './ayuda';

const VERSION = configJuego().consentimiento.version;
let admin: string;

async function registrar(nombre = 'est') {
  const email = correo(nombre);
  const token = await tokenGoogle(email);
  await llamar(postSesion, { token });
  const uid = (await db().collection(COL.identidades).where('email', '==', email).get()).docs[0]!.id;
  return { token, uid, email };
}

async function estudianteEn(codigo: string) {
  const e = await registrar();
  await llamar(postConsentimiento, { token: e.token, cuerpo: { version: VERSION } });
  const u = await llamar(postUnirse, { token: e.token, cuerpo: { codigo } });
  expect(u.status).toBe(200);
  await llamar(patchPerfil, { token: e.token, metodo: 'PATCH', cuerpo: { avatar: configJuego().avatares[0] } });
  return e;
}

async function nuevaAula(datos: Record<string, unknown>) {
  const r = await llamar(postAula, {
    token: admin,
    cuerpo: { nombre: 'Aula', facultad: 'Ciencias de la Salud', brazo: 'experimental', fechaInicio: fechaInicioDia(2), ...datos },
  });
  expect(r.status).toBe(200);
  return r.datos.aula as { id: string; codigoUnion: string; dia: number; fase: string };
}

beforeEach(async () => {
  await limpiar();
  admin = await tokenGoogle(correo('admin'));
  expect((await llamar(postSesion, { token: admin })).datos.rol).toBe('admin');
});

describe('aulas (PA1, criterio 13)', () => {
  it('el admin crea un aula con código de unión y un estudiante se une con él', async () => {
    const a = await nuevaAula({ nombre: 'Enfermería 7A' });
    expect(a.codigoUnion).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(a).toMatchObject({ dia: 2, fase: 'Día 2 de 7' });
    await estudianteEn(a.codigoUnion);
    const lista = await llamar(getAulasAdmin, { token: admin, metodo: 'GET' });
    expect(lista.datos.aulas[0]).toMatchObject({ nombre: 'Enfermería 7A', inscritos: 1 });
  });

  it('desactivar, cambiar la fecha y regenerar el código (el viejo deja de funcionar)', async () => {
    const a = await nuevaAula({});
    await llamar(patchAulaAdmin, { token: admin, metodo: 'PATCH', params: { id: a.id }, cuerpo: { activa: false } });
    const e = await registrar();
    await llamar(postConsentimiento, { token: e.token, cuerpo: { version: VERSION } });
    expect((await llamar(postUnirse, { token: e.token, cuerpo: { codigo: a.codigoUnion } })).datos.error).toBe('aula_inactiva');

    const r = await llamar(patchAulaAdmin, {
      token: admin,
      metodo: 'PATCH',
      params: { id: a.id },
      cuerpo: { activa: true, regenerarCodigo: true, fechaInicio: fechaInicioDia(5) },
    });
    expect(r.datos.aula.codigoUnion).not.toBe(a.codigoUnion);
    expect(r.datos.aula.dia).toBe(5);
    expect((await llamar(postUnirse, { token: e.token, cuerpo: { codigo: a.codigoUnion } })).datos.error).toBe('codigo_incorrecto');
    expect((await llamar(postUnirse, { token: e.token, cuerpo: { codigo: r.datos.aula.codigoUnion } })).status).toBe(200);
  });

  it('solo el admin crea aulas', async () => {
    const e = await registrar();
    const r = await llamar(postAula, {
      token: e.token,
      cuerpo: { nombre: 'X', facultad: 'Y', brazo: 'control', fechaInicio: fechaInicioDia(1) },
    });
    expect(r.datos.error).toBe('rol_no_permitido');
  });
});

describe('promotor asignado por el admin ve su aula (criterio 13)', () => {
  it('al ingresar, el promotor ve el aula que le asignó el admin', async () => {
    const a = await nuevaAula({ nombre: 'Aula del promotor' });
    await nuevaAula({ nombre: 'Otra aula' });
    const p = await registrar('promotor');
    await llamar(patchRol, { token: admin, metodo: 'PATCH', params: { uid: p.uid }, cuerpo: { rol: 'promotor', aulasPromotor: [a.id] } });
    expect((await llamar(postSesion, { token: p.token })).datos.siguientePaso).toBe('/panel');
    const r = await llamar(getAulasPanel, { token: p.token, metodo: 'GET' });
    expect(r.datos.aulas.map((x: { nombre: string }) => x.nombre)).toEqual(['Aula del promotor']);
  });
});

describe('participantes (PA4, criterio 13)', () => {
  it('mover de aula: conserva el progreso, ajusta inscritos y equipo y registra aula_movida', async () => {
    const a = await nuevaAula({ nombre: 'Aula A' });
    const b = await nuevaAula({ nombre: 'Aula B', brazo: 'control' });
    const e = await estudianteEn(a.codigoUnion);
    await db().collection(COL.usuarios).doc(e.uid).update({ xp: 40, 'resumen.lec-mitos': { estado: 'completada' } });
    const r = await llamar(postMover, { token: admin, params: { uid: e.uid }, cuerpo: { aulaId: b.id } });
    expect(r.datos).toMatchObject({ aulaId: b.id, brazo: 'control', equipo: null });
    const u = (await db().collection(COL.usuarios).doc(e.uid).get()).data()!;
    expect(u).toMatchObject({ aulaId: b.id, brazo: 'control', equipo: null, xp: 40 });
    expect(u.resumen['lec-mitos']).toBeTruthy();
    expect((await db().collection(COL.aulas).doc(a.id).get()).data()!.inscritos).toBe(0);
    expect((await db().collection(COL.aulas).doc(b.id).get()).data()!.inscritos).toBe(1);
    expect((await db().collection(COL.eventos).where('tipo', '==', 'aula_movida').get()).size).toBe(1);
    expect((await llamar(postMover, { token: admin, params: { uid: e.uid }, cuerpo: { aulaId: b.id } })).datos.error).toBe('misma_aula');
  });

  it('retirar: queda bloqueado y fuera del ranking; se puede reactivar', async () => {
    const a = await nuevaAula({});
    const e1 = await estudianteEn(a.codigoUnion);
    const e2 = await estudianteEn(a.codigoUnion);
    await db().collection(COL.usuarios).doc(e2.uid).update({ xp: 100 });
    expect((await llamar(getRanking, { token: e1.token, metodo: 'GET' })).datos.equipos).toHaveLength(2);

    await llamar(postRetirar, { token: admin, params: { uid: e2.uid }, cuerpo: { retirado: true } });
    expect((await llamar(postSesion, { token: e2.token })).datos.error).toBe('retirado');
    const rk = await llamar(getRanking, { token: e1.token, metodo: 'GET' });
    expect(rk.datos.equipos.map((x: { equipo: string }) => x.equipo)).toEqual(['E1']);
    expect((await db().collection(COL.eventos).where('tipo', '==', 'retirado').get()).size).toBe(1);

    await llamar(postRetirar, { token: admin, params: { uid: e2.uid }, cuerpo: { retirado: false } });
    expect((await llamar(postSesion, { token: e2.token })).status).toBe(200);
  });
});

describe('configuración (PA5)', () => {
  it('guarda los enlaces con {codigo} y rechaza los que no son http(s)', async () => {
    const url = 'https://docs.google.com/forms/d/e/x/viewform?usp=pp_url&entry.123={codigo}';
    const ok = await llamar(putConfig, { token: admin, metodo: 'PUT', cuerpo: { enlaces: { o1: url, o3: '' } } });
    expect(ok.datos.enlaces).toMatchObject({ o1: url, o3: null });
    expect((await llamar(getConfig, { token: admin, metodo: 'GET' })).datos.enlaces.o1).toBe(url);
    const mal = await llamar(putConfig, { token: admin, metodo: 'PUT', cuerpo: { enlaces: { o1: 'javascript:alert(1)' } } });
    expect(mal.datos.error).toBe('enlace_invalido');
  });
});

describe('vista previa (PA6, criterio 13)', () => {
  it('recorre la app como estudiante ficticio y no escribe nada en Firestore', async () => {
    const antes = await volcado();
    const q = (ruta: string, brazo = 'experimental', dia = 3) => `http://x/api/vista-previa/${ruta}?brazo=${brazo}&dia=${dia}`;

    const yo = await llamar(vpGet as never, { token: admin, metodo: 'GET', url: q('yo'), params: { ruta: ['yo'] } as never });
    expect(yo.datos).toMatchObject({ vistaPrevia: true, dia: 3 });
    expect(yo.datos.juego.xp).toBe(0);
    const ctl = await llamar(vpGet as never, { token: admin, metodo: 'GET', url: q('yo', 'control'), params: { ruta: ['yo'] } as never });
    expect(ctl.datos.juego).toBeNull();

    // Responde un caso, completa una lectura, envía una misión y registra asistencia: nada se guarda.
    const caso = catalogo().actividades.get('caso-botica-1')!.actividad;
    if (caso.tipo !== 'caso') throw new Error('tipo');
    const pos = permutacion(3, 'vista-previa|caso-botica-1').indexOf(caso.opciones.findIndex((o) => o.responsable));
    const r = await llamar(vpPost as never, {
      token: admin,
      url: q('actividades/caso-botica-1/responder'),
      params: { ruta: ['actividades', 'caso-botica-1', 'responder'] } as never,
      cuerpo: { opcion: pos },
    });
    expect(r.datos).toMatchObject({ correcta: true, xpOtorgado: 15, vistaPrevia: true });
    await llamar(vpPost as never, { token: admin, url: q('actividades/lec-mitos/completar'), params: { ruta: ['actividades', 'lec-mitos', 'completar'] } as never });
    const m = await llamar(vpPost as never, {
      token: admin,
      url: q('evidencias'),
      params: { ruta: ['evidencias'] } as never,
      cuerpo: { misionId: 'mision-botiquin', campos: { hayAntibioticos: 'No', cuantos: 0, accion: 'No había' } },
    });
    expect(m.datos.estado).toBe('pendiente');
    const as = await llamar(vpPost as never, {
      token: admin,
      url: q('actividades/enc-1/asistencia'),
      params: { ruta: ['actividades', 'enc-1', 'asistencia'] } as never,
      cuerpo: { codigo: 'vista' },
    });
    expect(as.datos.xpOtorgado).toBe(20);

    const despues = await volcado();
    expect(despues.map((d) => d.ruta).sort()).toEqual(antes.map((d) => d.ruta).sort());
  });

  it('un estudiante no puede usar la vista previa', async () => {
    const e = await registrar();
    const r = await llamar(vpGet as never, {
      token: e.token,
      metodo: 'GET',
      url: 'http://x/api/vista-previa/yo?brazo=experimental&dia=1',
      params: { ruta: ['yo'] } as never,
    });
    expect(r.datos.error).toBe('rol_no_permitido');
  });
});
