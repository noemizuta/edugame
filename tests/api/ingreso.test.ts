import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as postSesion } from '@/app/api/sesion/route';
import { POST as postConsentimiento } from '@/app/api/consentimiento/route';
import { POST as postUnirse } from '@/app/api/aulas/unirse/route';
import { PATCH as patchPerfil } from '@/app/api/perfil/route';
import { GET as getUsuarios } from '@/app/api/admin/usuarios/route';
import { PATCH as patchRol } from '@/app/api/admin/usuarios/[uid]/rol/route';
import { GET as getPoblacion } from '@/app/api/admin/poblacion/route';
import { configJuego } from '@/lib/contenido';
import { db } from '@/lib/firebase-admin';
import { COL } from '@/lib/modelo';
import { correo, crearAula, limpiar, llamar, tokenContrasena, tokenGoogle, volcado } from './ayuda';

const VERSION = configJuego().consentimiento.version;

/** Crea el primer admin (la primera cuenta que ingresa) y devuelve su token. */
async function primerAdmin() {
  const token = await tokenGoogle(correo('admin'));
  const r = await llamar(postSesion, { token });
  expect(r.datos.rol).toBe('admin');
  return token;
}

/** Estudiante con sesión y consentimiento. */
async function estudiante(nombre = 'estudiante') {
  const email = correo(nombre);
  const token = await tokenGoogle(email);
  const s = await llamar(postSesion, { token });
  expect(s.datos.rol).toBe('estudiante');
  const c = await llamar(postConsentimiento, { token, cuerpo: { version: VERSION } });
  expect(c.status).toBe(200);
  return { token, email, codigo: s.datos.perfil.codigo as string, uid: await uidDe(email) };
}

async function uidDe(email: string) {
  const r = await db().collection(COL.identidades).where('email', '==', email).get();
  return r.docs[0]!.id;
}

const unirse = (token: string, codigo: string) => llamar(postUnirse, { token, cuerpo: { codigo } });

beforeEach(limpiar);
afterEach(() => {
  delete process.env.DOMINIOS_PERMITIDOS;
});

describe('POST /api/sesion', () => {
  it('rechaza solicitudes sin token o con un token inválido', async () => {
    expect((await llamar(postSesion)).status).toBe(401);
    expect((await llamar(postSesion, { token: 'no-es-un-token' })).datos.error).toBe('token_invalido');
  });

  it('solo acepta cuentas de Google', async () => {
    const r = await llamar(postSesion, { token: await tokenContrasena(correo()) });
    expect(r.status).toBe(403);
    expect(r.datos.error).toBe('proveedor_no_permitido');
  });

  it('la primera cuenta es admin y las siguientes son estudiantes (decisión 6)', async () => {
    const admin = await llamar(postSesion, { token: await tokenGoogle(correo('admin')) });
    expect(admin.datos).toMatchObject({ ok: true, rol: 'admin', siguientePaso: '/admin' });

    const est = await llamar(postSesion, { token: await tokenGoogle(correo()) });
    expect(est.datos).toMatchObject({ ok: true, rol: 'estudiante', siguientePaso: '/consentimiento' });
    expect(est.datos.perfil.codigo).toMatch(/^G-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
    expect((await db().doc('config/sistema').get()).data()?.primerAdmin).toBeTruthy();
  });

  it('dos primeros ingresos simultáneos dejan un solo admin', async () => {
    const tokens = await Promise.all([1, 2, 3].map(() => tokenGoogle(correo())));
    const r = await Promise.all(tokens.map((token) => llamar(postSesion, { token })));
    expect(r.map((x) => x.datos.rol).filter((x) => x === 'admin')).toHaveLength(1);
  });

  it('no guarda correos ni nombres fuera de identidades (criterio 1)', async () => {
    await primerAdmin();
    const email = correo('ana.perez');
    await llamar(postSesion, { token: await tokenGoogle(email, 'Ana Pérez') });
    const docs = await volcado();
    const fuera = docs.filter((d) => !d.ruta.startsWith('identidades/'));
    for (const d of fuera) {
      const texto = JSON.stringify(d.datos);
      expect(texto, d.ruta).not.toContain('@');
      expect(texto, d.ruta).not.toContain('Ana Pérez');
    }
    expect(docs.some((d) => d.ruta.startsWith('identidades/') && d.datos.email === email)).toBe(true);
  });

  it('conserva el código y registra la sesión como máximo una vez por hora', async () => {
    await primerAdmin();
    const token = await tokenGoogle(correo());
    const a = await llamar(postSesion, { token });
    const b = await llamar(postSesion, { token });
    expect(b.datos.perfil.codigo).toBe(a.datos.perfil.codigo);
    const uid = (await db().collection(COL.codigosParticipante).doc(a.datos.perfil.codigo).get()).data()!.uid;
    const sesiones = await db().collection(COL.eventos).where('uid', '==', uid).where('tipo', '==', 'sesion').get();
    expect(sesiones.size).toBe(1);
  });

  it('con DOMINIOS_PERMITIDOS solo entran esas cuentas (el primer admin queda exento)', async () => {
    process.env.DOMINIOS_PERMITIDOS = 'unac.edu.pe';
    expect((await llamar(postSesion, { token: await tokenGoogle('duena@gmail.com') })).datos.rol).toBe('admin');
    const fuera = await llamar(postSesion, { token: await tokenGoogle('alguien@gmail.com') });
    expect(fuera.status).toBe(403);
    expect(fuera.datos.error).toBe('dominio_no_permitido');
    const dentro = await llamar(postSesion, { token: await tokenGoogle('alumno@unac.edu.pe') });
    expect(dentro.datos.rol).toBe('estudiante');
  });

  it('un estudiante retirado queda bloqueado', async () => {
    await primerAdmin();
    const e = await estudiante();
    await db().collection(COL.usuarios).doc(e.uid).update({ retirado: true });
    const r = await llamar(postSesion, { token: e.token });
    expect(r.status).toBe(403);
    expect(r.datos.error).toBe('retirado');
    expect((await unirse(e.token, 'EXPE26')).datos.error).toBe('retirado');
  });
});

describe('consentimiento', () => {
  it('es obligatorio antes de unirse a un aula', async () => {
    await primerAdmin();
    await crearAula('a1', { brazo: 'experimental', codigoUnion: 'EXPE26' });
    const token = await tokenGoogle(correo());
    await llamar(postSesion, { token });
    const r = await unirse(token, 'EXPE26');
    expect(r.status).toBe(409);
    expect(r.datos).toMatchObject({ error: 'paso_pendiente', siguientePaso: '/consentimiento' });
  });

  it('registra la versión vigente y rechaza otra', async () => {
    await primerAdmin();
    const token = await tokenGoogle(correo());
    await llamar(postSesion, { token });
    expect((await llamar(postConsentimiento, { token, cuerpo: { version: '0.1' } })).datos.error).toBe('version_invalida');
    const ok = await llamar(postConsentimiento, { token, cuerpo: { version: VERSION } });
    expect(ok.datos.siguientePaso).toBe('/unirse');
    const s = await llamar(postSesion, { token });
    expect(s.datos.perfil.consentimiento).toBe(true);
  });
});

describe('POST /api/aulas/unirse (criterios 3 y 4)', () => {
  beforeEach(async () => {
    await primerAdmin();
    await crearAula('exp', { brazo: 'experimental', codigoUnion: 'EXPE26', nombre: 'Enfermería A' });
    await crearAula('ctl', { brazo: 'control', codigoUnion: 'CTRL26', nombre: 'Enfermería B' });
  });

  it('un código incorrecto da error', async () => {
    const e = await estudiante();
    const r = await unirse(e.token, 'ZZZZZZ');
    expect(r.status).toBe(404);
    expect(r.datos.error).toBe('codigo_incorrecto');
  });

  it('no distingue mayúsculas e ignora espacios', async () => {
    const e = await estudiante();
    const r = await unirse(e.token, ' expe 26 ');
    expect(r.status).toBe(200);
    expect(r.datos).toMatchObject({ aula: { nombre: 'Enfermería A', brazo: 'experimental' }, siguientePaso: '/bienvenida-aula' });
  });

  it('el intento 11 en una hora se bloquea, aunque el código sea correcto', async () => {
    const e = await estudiante();
    for (let i = 0; i < 10; i++) expect((await unirse(e.token, `XXXX${i}${i}`)).datos.error).toBe('codigo_incorrecto');
    const r = await unirse(e.token, 'EXPE26');
    expect(r.status).toBe(429);
    expect(r.datos.error).toBe('demasiados_intentos');
  });

  it('un aula con 30 inscritos rechaza al número 31', async () => {
    await db().collection(COL.aulas).doc('exp').update({ inscritos: 30 });
    const e = await estudiante();
    const r = await unirse(e.token, 'EXPE26');
    expect(r.datos.error).toBe('aula_completa');
  });

  it('rechaza un aula inactiva', async () => {
    await db().collection(COL.aulas).doc('exp').update({ activa: false });
    const e = await estudiante();
    expect((await unirse(e.token, 'EXPE26')).datos.error).toBe('aula_inactiva');
  });

  it('quien ya pertenece a un aula no puede unirse a otra', async () => {
    const e = await estudiante();
    await unirse(e.token, 'EXPE26');
    const r = await unirse(e.token, 'CTRL26');
    expect(r.status).toBe(409);
    expect(r.datos).toMatchObject({ error: 'ya_en_aula', aula: 'Enfermería A' });
  });

  it('12 uniones al experimental dejan 2 integrantes en E1–E6', async () => {
    const equipos: string[] = [];
    for (let i = 0; i < 12; i++) {
      const e = await estudiante();
      equipos.push((await unirse(e.token, 'EXPE26')).datos.equipo);
    }
    const conteo = Object.fromEntries(['E1', 'E2', 'E3', 'E4', 'E5', 'E6'].map((x) => [x, equipos.filter((y) => y === x).length]));
    expect(conteo).toEqual({ E1: 2, E2: 2, E3: 2, E4: 2, E5: 2, E6: 2 });
    const aula = (await db().collection(COL.aulas).doc('exp').get()).data()!;
    expect(aula.inscritos).toBe(12);
    expect(aula.equipos).toEqual({ E1: 2, E2: 2, E3: 2, E4: 2, E5: 2, E6: 2 });
  });

  it('en el control el equipo queda en null', async () => {
    const e = await estudiante();
    const r = await unirse(e.token, 'CTRL26');
    expect(r.datos.equipo).toBeNull();
    const u = (await db().collection(COL.usuarios).doc(e.uid).get()).data()!;
    expect(u).toMatchObject({ aulaId: 'ctl', brazo: 'control', equipo: null });
  });

  it('registra el evento unirse_aula con aula, brazo, equipo y día', async () => {
    const e = await estudiante();
    await unirse(e.token, 'EXPE26');
    const ev = await db().collection(COL.eventos).where('uid', '==', e.uid).where('tipo', '==', 'unirse_aula').get();
    expect(ev.size).toBe(1);
    expect(ev.docs[0]!.data()).toMatchObject({ aulaId: 'exp', brazo: 'experimental', equipo: 'E1', codigo: e.codigo, rol: 'estudiante' });
    expect(ev.docs[0]!.data().dia).toBe(1);
  });
});

describe('PATCH /api/perfil (avatar)', () => {
  it('exige aula y un avatar de la lista', async () => {
    await primerAdmin();
    await crearAula('exp', { brazo: 'experimental', codigoUnion: 'EXPE26' });
    const e = await estudiante();
    expect((await llamar(patchPerfil, { token: e.token, metodo: 'PATCH', cuerpo: { avatar: '🦸' } })).status).toBe(409);
    await unirse(e.token, 'EXPE26');
    expect((await llamar(patchPerfil, { token: e.token, metodo: 'PATCH', cuerpo: { avatar: '💩' } })).datos.error).toBe(
      'avatar_invalido',
    );
    const r = await llamar(patchPerfil, { token: e.token, metodo: 'PATCH', cuerpo: { avatar: configJuego().avatares[6] } });
    expect(r.datos.siguientePaso).toBe('/inicio');
    expect((await llamar(postSesion, { token: e.token })).datos.siguientePaso).toBe('/inicio');
  });
});

describe('roles asignados por el admin (decisión 6)', () => {
  const cambiar = (token: string, uid: string, rol: string, aulasPromotor: string[] = []) =>
    llamar(patchRol, { token, metodo: 'PATCH', params: { uid }, cuerpo: { rol, aulasPromotor } });

  it('busca por correo o código y registra consulta_identidad', async () => {
    const admin = await primerAdmin();
    const e = await estudiante();
    const porCorreo = await llamar(getUsuarios, { token: admin, metodo: 'GET', url: `http://x/api/admin/usuarios?q=${e.email}` });
    expect(porCorreo.datos.usuarios).toHaveLength(1);
    expect(porCorreo.datos.usuarios[0]).toMatchObject({ email: e.email, codigo: e.codigo, rol: 'estudiante' });
    const porCodigo = await llamar(getUsuarios, {
      token: admin,
      metodo: 'GET',
      url: `http://x/api/admin/usuarios?q=${e.codigo.toLowerCase()}`,
    });
    expect(porCodigo.datos.usuarios[0].uid).toBe(e.uid);
    const ev = await db().collection(COL.eventos).where('tipo', '==', 'consulta_identidad').get();
    expect(ev.size).toBe(2);
    expect(JSON.stringify(ev.docs.map((d) => d.data()))).not.toContain('@');
  });

  it('solo el admin busca y asigna roles', async () => {
    await primerAdmin();
    const e = await estudiante();
    expect((await llamar(getUsuarios, { token: e.token, metodo: 'GET', url: 'http://x/api/admin/usuarios?q=G-AAAAA' })).status).toBe(403);
    expect((await cambiarLibre(e.token, e.uid, 'admin')).datos.error).toBe('rol_no_permitido');
  });

  it('el admin convierte a un estudiante en investigador, que va a /seguimiento y no puede resolver actividades', async () => {
    const admin = await primerAdmin();
    const e = await estudiante();
    const r = await cambiar(admin, e.uid, 'investigador');
    expect(r.datos.usuario).toMatchObject({ rol: 'investigador', aulasPromotor: [] });
    expect((await llamar(postSesion, { token: e.token })).datos).toMatchObject({ rol: 'investigador', siguientePaso: '/seguimiento' });
    expect((await llamar(postConsentimiento, { token: e.token, cuerpo: { version: VERSION } })).datos.error).toBe('rol_no_permitido');
    expect((await unirse(e.token, 'EXPE26')).datos.error).toBe('rol_no_permitido');
    const ev = await db().collection(COL.eventos).where('tipo', '==', 'rol_cambiado').get();
    expect(ev.docs[0]!.data().detalle).toMatch(/^estudiante → investigador/);
  });

  it('un estudiante que pasa a promotor sale de su aula y recibe sus aulas', async () => {
    const admin = await primerAdmin();
    await crearAula('exp', { brazo: 'experimental', codigoUnion: 'EXPE26' });
    await crearAula('ctl', { brazo: 'control', codigoUnion: 'CTRL26' });
    const e = await estudiante();
    await unirse(e.token, 'EXPE26');
    const r = await cambiar(admin, e.uid, 'promotor', ['exp', 'ctl']);
    expect(r.datos.usuario).toMatchObject({ rol: 'promotor', aula: null, aulasPromotor: ['exp', 'ctl'] });
    const aula = (await db().collection(COL.aulas).doc('exp').get()).data()!;
    expect(aula.inscritos).toBe(0);
    expect(aula.equipos.E1).toBe(0);
    expect((await llamar(postSesion, { token: e.token })).datos.siguientePaso).toBe('/panel');
    expect((await cambiar(admin, e.uid, 'promotor', ['no-existe'])).datos.error).toBe('aula_no_encontrada');
  });

  it('nadie cambia su propio rol', async () => {
    const admin = await primerAdmin();
    const uid = (await db().collection(COL.usuarios).where('rol', '==', 'admin').get()).docs[0]!.id;
    const r = await cambiar(admin, uid, 'estudiante');
    expect(r.status).toBe(403);
    expect(r.datos.error).toBe('propio_rol');
  });

  it('población a demanda: todos con su rol; correo solo del personal y sin consulta_identidad', async () => {
    await crearAula('exp', { brazo: 'experimental', codigoUnion: 'EXPE26', nombre: 'Enfermería A' });
    const admin = await primerAdmin();
    const inv = await estudiante('inv');
    const prom = await estudiante('prom');
    const e = await estudiante('alumna');
    expect((await unirse(e.token, 'EXPE26')).status).toBe(200);
    await cambiar(admin, inv.uid, 'investigador');
    await cambiar(admin, prom.uid, 'promotor', ['exp']);

    const r = await llamar(getPoblacion, { token: admin, metodo: 'GET' });
    expect(r.status).toBe(200);
    expect(r.datos.aulas.map((a: { id: string }) => a.id)).toEqual(['exp']);
    const porUid = new Map(r.datos.usuarios.map((u: { uid: string }) => [u.uid, u]));
    expect(porUid.get(inv.uid)).toMatchObject({ rol: 'investigador', email: inv.email, aula: null });
    expect(porUid.get(prom.uid)).toMatchObject({ rol: 'promotor', email: prom.email, aulasPromotor: ['exp'] });
    expect(porUid.get(e.uid)).toMatchObject({ rol: 'estudiante', email: null, codigo: e.codigo, aula: { id: 'exp', nombre: 'Enfermería A' } });
    expect(r.datos.usuarios).toHaveLength(4);

    const consultas = await db().collection(COL.eventos).where('tipo', '==', 'consulta_identidad').get();
    expect(consultas.size).toBe(0);
    expect((await llamar(getPoblacion, { token: e.token, metodo: 'GET' })).status).toBe(403);
  });
});

/** Igual que `cambiar`, para probar con tokens sin permiso. */
function cambiarLibre(token: string, uid: string, rol: string) {
  return llamar(patchRol, { token, metodo: 'PATCH', params: { uid }, cuerpo: { rol } });
}
