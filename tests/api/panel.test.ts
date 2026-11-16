import { beforeEach, describe, expect, it } from 'vitest';
import { POST as postSesion } from '@/app/api/sesion/route';
import { POST as postConsentimiento } from '@/app/api/consentimiento/route';
import { POST as postUnirse } from '@/app/api/aulas/unirse/route';
import { PATCH as patchPerfil } from '@/app/api/perfil/route';
import { GET as getYo } from '@/app/api/yo/route';
import { GET as getActividad } from '@/app/api/actividades/[id]/route';
import { POST as postCompletar } from '@/app/api/actividades/[id]/completar/route';
import { POST as postAsistencia } from '@/app/api/actividades/[id]/asistencia/route';
import { POST as postEvidencia } from '@/app/api/evidencias/route';
import { GET as getAulasPanel } from '@/app/api/panel/aulas/route';
import { PATCH as patchAula } from '@/app/api/panel/aulas/[aulaId]/route';
import { GET as getParticipantes } from '@/app/api/panel/aulas/[aulaId]/participantes/route';
import { GET as getEncuentros } from '@/app/api/panel/aulas/[aulaId]/encuentros/route';
import { PUT as putEncuentro } from '@/app/api/panel/aulas/[aulaId]/encuentros/[encId]/route';
import { PATCH as patchEquipo } from '@/app/api/panel/participantes/[uid]/equipo/route';
import { GET as getEvidencias } from '@/app/api/panel/evidencias/route';
import { POST as postRevisar } from '@/app/api/panel/evidencias/[id]/route';
import { GET as getCsvEventos } from '@/app/api/export/eventos.csv/route';
import { GET as getCsvParticipantes } from '@/app/api/export/participantes.csv/route';
import { configJuego } from '@/lib/contenido';
import { db } from '@/lib/firebase-admin';
import { COLUMNAS_EVENTOS, COLUMNAS_PARTICIPANTES } from '@/lib/csv';
import { COL } from '@/lib/modelo';
import { correo, crearAula, fechaInicioDia, limpiar, llamar, tokenGoogle } from './ayuda';

const VERSION = configJuego().consentimiento.version;
const DIA = 86_400_000;

async function cuenta(rol: 'promotor' | 'investigador' | 'admin', aulas: string[] = []) {
  const email = correo(rol);
  const token = await tokenGoogle(email);
  await llamar(postSesion, { token });
  const uid = (await db().collection(COL.identidades).where('email', '==', email).get()).docs[0]!.id;
  await db().collection(COL.usuarios).doc(uid).update({ rol, aulasPromotor: aulas });
  return { token, uid };
}

async function estudianteEn(codigoAula: string) {
  const email = correo('est');
  const token = await tokenGoogle(email);
  await llamar(postSesion, { token });
  await llamar(postConsentimiento, { token, cuerpo: { version: VERSION } });
  const u = await llamar(postUnirse, { token, cuerpo: { codigo: codigoAula } });
  await llamar(patchPerfil, { token, metodo: 'PATCH', cuerpo: { avatar: configJuego().avatares[0] } });
  const uid = (await db().collection(COL.identidades).where('email', '==', email).get()).docs[0]!.id;
  const codigo = (await db().collection(COL.usuarios).doc(uid).get()).data()!.codigo as string;
  return { token, uid, codigo, equipo: u.datos.equipo as string | null };
}

const GET = (h: unknown, token: string, opciones: { params?: Record<string, string>; url?: string } = {}) =>
  llamar(h as never, { token, metodo: 'GET', ...opciones });

beforeEach(async () => {
  await limpiar();
  await llamar(postSesion, { token: await tokenGoogle(correo('admin')) }); // primer admin
  await crearAula('exp', { brazo: 'experimental', codigoUnion: 'EXPE26', nombre: 'Enfermería A', fechaInicio: fechaInicioDia(3) });
  await crearAula('ctl', { brazo: 'control', codigoUnion: 'CTRL26', nombre: 'Enfermería B', fechaInicio: fechaInicioDia(3) });
});

describe('permisos del panel (criterio 12)', () => {
  it('el promotor solo ve y opera sus aulas; el investigador ve todas pero no edita', async () => {
    const p1 = await cuenta('promotor', ['exp']);
    const inv = await cuenta('investigador');
    expect((await GET(getAulasPanel, p1.token)).datos.aulas.map((a: { id: string }) => a.id)).toEqual(['exp']);
    expect((await GET(getParticipantes, p1.token, { params: { aulaId: 'ctl' } })).status).toBe(403);
    expect((await GET(getParticipantes, p1.token, { params: { aulaId: 'exp' } })).status).toBe(200);
    expect((await GET(getCsvEventos, p1.token, { url: 'http://x/api/export/eventos.csv?aulaId=ctl' })).status).toBe(403);

    expect((await GET(getAulasPanel, inv.token)).datos.aulas).toHaveLength(2);
    expect((await GET(getParticipantes, inv.token, { params: { aulaId: 'ctl' } })).status).toBe(200);
    const r = await llamar(patchAula, { token: inv.token, metodo: 'PATCH', params: { aulaId: 'exp' }, cuerpo: { enlaceGrupo: null } });
    expect(r.datos.error).toBe('rol_no_permitido');

    const est = await estudianteEn('EXPE26');
    expect((await GET(getAulasPanel, est.token)).status).toBe(403);
  });
});

describe('semáforo y mensajes (criterio 12)', () => {
  it('muestra los 3 colores y el mensaje de reenganche con el código', async () => {
    const p = await cuenta('promotor', ['exp']);
    const est = await Promise.all([0, 2, 5].map(() => estudianteEn('EXPE26')));
    const ahora = Date.now();
    await Promise.all(
      [0, 2, 5].map((d, i) => db().collection(COL.usuarios).doc(est[i]!.uid).update({ ultimoAcceso: new Date(ahora - d * DIA) })),
    );
    const r = await GET(getParticipantes, p.token, { params: { aulaId: 'exp' } });
    expect(r.datos.contadores).toEqual({ verde: 1, amarillo: 1, rojo: 1 });
    const fila = (uid: string) => r.datos.participantes.find((x: { uid: string }) => x.uid === uid);
    expect(fila(est[0]!.uid)).toMatchObject({ semaforo: { color: 'verde', texto: 'Hoy' }, mensaje: null });
    expect(fila(est[1]!.uid).semaforo.color).toBe('amarillo');
    expect(fila(est[1]!.uid).mensaje).toBe(configJuego().reenganche.amarillo.replaceAll('{codigo}', est[1]!.codigo));
    expect(fila(est[2]!.uid).mensaje).toContain(est[2]!.codigo);
    expect(JSON.stringify(r.datos)).not.toContain('@');
  });
});

describe('equipos (PP2)', () => {
  it('cambia el equipo, actualiza los contadores y no deja pasar de 5', async () => {
    const p = await cuenta('promotor', ['exp']);
    const a = await estudianteEn('EXPE26'); // E1
    const r = await llamar(patchEquipo, { token: p.token, metodo: 'PATCH', params: { uid: a.uid }, cuerpo: { equipo: 'E3' } });
    expect(r.datos).toMatchObject({ equipo: 'E3' });
    const aula = (await db().collection(COL.aulas).doc('exp').get()).data()!;
    expect(aula.equipos).toMatchObject({ E1: 0, E3: 1 });
    expect((await db().collection(COL.eventos).where('tipo', '==', 'equipo_cambiado').get()).size).toBe(1);

    await db().collection(COL.aulas).doc('exp').update({ 'equipos.E5': 5 });
    const lleno = await llamar(patchEquipo, { token: p.token, metodo: 'PATCH', params: { uid: a.uid }, cuerpo: { equipo: 'E5' } });
    expect(lleno.status).toBe(409);
    expect(lleno.datos.error).toBe('equipo_lleno');
  });

  it('no aplica al control ni a aulas ajenas', async () => {
    const p = await cuenta('promotor', ['exp']);
    const c = await estudianteEn('CTRL26');
    const r = await llamar(patchEquipo, { token: p.token, metodo: 'PATCH', params: { uid: c.uid }, cuerpo: { equipo: 'E2' } });
    expect(r.datos.error).toBe('aula_no_permitida');
    const admin = await cuenta('admin');
    const r2 = await llamar(patchEquipo, { token: admin.token, metodo: 'PATCH', params: { uid: c.uid }, cuerpo: { equipo: 'E2' } });
    expect(r2.datos.error).toBe('solo_experimental');
  });
});

describe('misión de campo (criterio 10)', () => {
  const campos = { hayAntibioticos: 'Sí', cuantos: 2, accion: 'Pregunté cómo desecharlos', comentario: 'Aprendí algo.' };

  it('enviar → devolver sin comentario falla → aprobar → ✅, +30 XP e insignia Auditor', async () => {
    const p = await cuenta('promotor', ['exp']);
    const e = await estudianteEn('EXPE26');
    await llamar(postEvidencia, { token: e.token, cuerpo: { misionId: 'mision-botiquin', campos } });
    expect((await GET(getActividad, e.token, { params: { id: 'mision-botiquin' } })).datos.actividad.estado).toBe('pendiente');

    const pend = await GET(getEvidencias, p.token, { url: 'http://x/api/panel/evidencias?aulaId=exp' });
    expect(pend.datos.evidencias).toHaveLength(1);
    const ev = pend.datos.evidencias[0];
    expect(ev).toMatchObject({ mision: 'Auditoría del botiquín', codigo: e.codigo, equipo: e.equipo });
    expect(ev.campos[0]).toEqual({ etiqueta: '¿Encontraste antibióticos sobrantes?', valor: 'Sí' });

    const sinComentario = await llamar(postRevisar, { token: p.token, params: { id: ev.id }, cuerpo: { accion: 'devolver', comentario: '  ' } });
    expect(sinComentario.datos.error).toBe('comentario_obligatorio');

    const ok = await llamar(postRevisar, { token: p.token, params: { id: ev.id }, cuerpo: { accion: 'aprobar' } });
    expect(ok.datos).toMatchObject({ estado: 'aprobada', xpOtorgado: 30 });
    expect((await llamar(postRevisar, { token: p.token, params: { id: ev.id }, cuerpo: { accion: 'aprobar' } })).datos.error).toBe('ya_revisada');

    const v = (await GET(getActividad, e.token, { params: { id: 'mision-botiquin' } })).datos.actividad;
    expect(v.estado).toBe('aprobada');
    const yo = (await GET(getYo, e.token)).datos;
    expect(yo.juego.xp).toBe(30);
    expect(yo.juego.insignias.find((i: { id: string }) => i.id === 'auditor').ganada).toBe(true);
    expect((await GET(getEvidencias, p.token, { url: 'http://x/api/panel/evidencias?aulaId=exp' })).datos.evidencias).toHaveLength(0);
  });

  it('devuelta con comentario: el participante la ve y puede reenviar', async () => {
    const p = await cuenta('promotor', ['exp']);
    const e = await estudianteEn('EXPE26');
    await llamar(postEvidencia, { token: e.token, cuerpo: { misionId: 'mision-botiquin', campos } });
    const ev = (await GET(getEvidencias, p.token, { url: 'http://x/api/panel/evidencias?aulaId=exp' })).datos.evidencias[0];
    const r = await llamar(postRevisar, { token: p.token, params: { id: ev.id }, cuerpo: { accion: 'devolver', comentario: 'Cuenta un poco más.' } });
    expect(r.datos.estado).toBe('devuelta');
    const v = (await GET(getActividad, e.token, { params: { id: 'mision-botiquin' } })).datos.actividad;
    expect(v).toMatchObject({ estado: 'devuelta', comentario: 'Cuenta un poco más.' });
    const otra = await llamar(postEvidencia, { token: e.token, cuerpo: { misionId: 'mision-botiquin', campos } });
    expect(otra.datos.estado).toBe('pendiente');
    expect((await db().collection(COL.usuarios).doc(e.uid).get()).data()!.xp).toBe(0);
  });
});

describe('encuentros y grupo (PP4, criterio 11)', () => {
  it('el promotor define «fleming6»; se guarda solo el hash y el participante lo usa', async () => {
    const p = await cuenta('promotor', ['exp']);
    const corto = await llamar(putEncuentro, { token: p.token, metodo: 'PUT', params: { aulaId: 'exp', encId: 'enc-1' }, cuerpo: { codigo: 'abc' } });
    expect(corto.datos.error).toBe('codigo_corto');
    const r = await llamar(putEncuentro, {
      token: p.token,
      metodo: 'PUT',
      params: { aulaId: 'exp', encId: 'enc-1' },
      cuerpo: { codigo: 'fleming6', enlace: 'https://meet.google.com/abc-defg-hij' },
    });
    expect(r.datos).toMatchObject({ codigoDefinido: true, codigoGuardado: 'FLEMING6' });
    const doc = (await db().collection(COL.aulas).doc('exp').collection(COL.encuentros).doc('enc-1').get()).data()!;
    expect(JSON.stringify(doc)).not.toMatch(/fleming/i);

    const lista = await GET(getEncuentros, p.token, { params: { aulaId: 'exp' } });
    expect(lista.datos.encuentros[0]).toMatchObject({ id: 'enc-1', enlace: 'https://meet.google.com/abc-defg-hij', codigoDefinido: true });
    expect(JSON.stringify(lista.datos)).not.toMatch(/fleming/i);

    const e = await estudianteEn('EXPE26');
    expect((await llamar(postAsistencia, { token: e.token, params: { id: 'enc-1' }, cuerpo: { codigo: 'otro' } })).status).toBe(400);
    expect((await llamar(postAsistencia, { token: e.token, params: { id: 'enc-1' }, cuerpo: { codigo: 'FLEMING6 ' } })).datos.xpOtorgado).toBe(20);
  });

  it('guarda el enlace del grupo y rechaza enlaces inválidos', async () => {
    const p = await cuenta('promotor', ['exp']);
    const mal = await llamar(patchAula, { token: p.token, metodo: 'PATCH', params: { aulaId: 'exp' }, cuerpo: { enlaceGrupo: 'javascript:alert(1)' } });
    expect(mal.datos.error).toBe('enlace_invalido');
    const ok = await llamar(patchAula, { token: p.token, metodo: 'PATCH', params: { aulaId: 'exp' }, cuerpo: { enlaceGrupo: 'https://t.me/+abc' } });
    expect(ok.datos.enlaceGrupo).toBe('https://t.me/+abc');
    const e = await estudianteEn('EXPE26');
    expect((await GET(getActividad, e.token, { params: { id: 'grupo-aula' } })).datos.actividad.enlace).toBe('https://t.me/+abc');
  });
});

describe('CSV (criterio 14)', () => {
  it('columnas de la sección 13, BOM, sin correos y días activos correctos', async () => {
    const p = await cuenta('promotor', ['exp']);
    const e = await estudianteEn('EXPE26');
    // Actividad los días 1 y 2, y una más el día 9, que ya no cuenta para la dosis (solo días 1–7)
    await db().collection(COL.aulas).doc('exp').update({ fechaInicio: fechaInicioDia(1) });
    await llamar(postCompletar, { token: e.token, params: { id: 'lec-virus-bacterias' } });
    await db().collection(COL.aulas).doc('exp').update({ fechaInicio: fechaInicioDia(2) });
    await llamar(postCompletar, { token: e.token, params: { id: 'lec-mitos' } });
    await db().collection(COL.aulas).doc('exp').update({ fechaInicio: fechaInicioDia(9) });
    await llamar(postCompletar, { token: e.token, params: { id: 'lec-mecanismos' } });

    // El CSV no es JSON: se llama al manejador directamente para leer el texto.
    const res = await getCsvParticipantes(new Request('http://x/api/export/participantes.csv?aulaId=exp', { headers: { Authorization: `Bearer ${p.token}` } }), { params: Promise.resolve({}) as never });
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8 para Excel
    const texto = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const [enc, fila] = texto.slice(1).trim().split('\r\n');
    expect(enc).toBe(COLUMNAS_PARTICIPANTES.join(','));
    const col = Object.fromEntries(COLUMNAS_PARTICIPANTES.map((c, i) => [c, fila!.split(',')[i]]));
    expect(col).toMatchObject({ codigo: e.codigo, aula: 'Enfermería A', brazo: 'experimental', dias_activos: '2', actividades_completadas: '3', retirado: 'false' });
    expect(texto).not.toContain('@');

    const resEv = await getCsvEventos(new Request('http://x/api/export/eventos.csv?aulaId=exp', { headers: { Authorization: `Bearer ${p.token}` } }), { params: Promise.resolve({}) as never });
    const ev = (await resEv.text()).trim().split('\r\n');
    expect(ev[0]).toBe(COLUMNAS_EVENTOS.join(','));
    expect(ev.length).toBeGreaterThan(4);
    expect(ev.join('\n')).not.toContain('@');
    const completar = ev.filter((l) => l.includes(',completar,'));
    expect(completar).toHaveLength(3);
    expect(completar[0]).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+Z,\d{4}-\d\d-\d\d \d\d:\d\d:\d\d,G-/);
  });

  it('el promotor debe indicar el aula; el admin puede exportar todas sin las de prueba', async () => {
    const p = await cuenta('promotor', ['exp']);
    expect((await GET(getCsvEventos, p.token, { url: 'http://x/api/export/eventos.csv' })).datos.error).toBe('aula_requerida');
    const admin = await cuenta('admin');
    await estudianteEn('EXPE26');
    const res = await getCsvParticipantes(new Request('http://x/api/export/participantes.csv', { headers: { Authorization: `Bearer ${admin.token}` } }), { params: Promise.resolve({}) as never });
    expect((await res.text()).trim().split('\r\n')).toHaveLength(1); // solo encabezados: las aulas son de prueba
    const res2 = await getCsvParticipantes(new Request('http://x/api/export/participantes.csv?incluirPrueba=1', { headers: { Authorization: `Bearer ${admin.token}` } }), { params: Promise.resolve({}) as never });
    expect((await res2.text()).trim().split('\r\n')).toHaveLength(2);
  });
});
