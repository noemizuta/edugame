import { describe, expect, it } from 'vitest';
import {
  type Equipo,
  type InsigniaCfg,
  type ModuloMin,
  ROLES,
  esPersonal,
  barajar,
  diasEntre,
  enlaceConCodigo,
  equipoConMenos,
  esCodigoAula,
  esCodigoParticipante,
  esFechaIso,
  esLunes,
  estadoModulo,
  fechaApertura,
  fechaCorta,
  fechaHoraLima,
  fechaLima,
  generarCodigoAula,
  generarCodigoParticipante,
  insignias,
  interpretarRegla,
  misionDeLaSemana,
  nivel,
  normalizarCodigoAsistencia,
  normalizarCodigoAula,
  normalizarCodigoParticipante,
  permutacion,
  prng,
  quitarExclamacionInicial,
  racha,
  rankingEquipos,
  semaforo,
  diaEstudio,
  diasActivos,
  textoFase,
  textoResultado,
  topeXp,
  xpQuiz,
  xpReto,
} from '@/lib/juego';
import config from '@/content/config-juego.json';
import calendario from '@/content/calendario.json';
import mision1 from '@/content/mision1.json';

/** Instante a partir de una hora local de Lima (UTC−5). */
const lima = (iso: string) => new Date(`${iso}-05:00`);

describe('fechas en Lima', () => {
  it('usa la fecha de Lima y no la de UTC', () => {
    // 23:30 del domingo en Lima = 04:30 del lunes en UTC
    expect(fechaLima(lima('2026-03-01T23:30:00'))).toBe('2026-03-01');
    expect(fechaLima(new Date('2026-03-02T04:59:59Z'))).toBe('2026-03-01');
    expect(fechaLima(new Date('2026-03-02T05:00:00Z'))).toBe('2026-03-02');
  });

  it('formatea fecha y hora de Lima para los CSV', () => {
    expect(fechaHoraLima(new Date('2026-03-02T04:30:15Z'))).toBe('2026-03-01 23:30:15');
  });

  it('valida fechas ISO y lunes', () => {
    expect(esFechaIso('2026-03-02')).toBe(true);
    expect(esFechaIso('2026-02-30')).toBe(false);
    expect(esFechaIso('2026-3-2')).toBe(false);
    expect(esLunes('2026-03-02')).toBe(true);
    expect(esLunes('2026-03-03')).toBe(false);
  });

  it('cuenta días de calendario', () => {
    expect(diasEntre('2026-03-02', '2026-03-09')).toBe(7);
    expect(diasEntre('2026-03-09', '2026-03-02')).toBe(-7);
  });
});

describe('día del estudio (decisión 7)', () => {
  const inicio = '2026-03-02'; // día 1

  it('el día de inicio es el día 1 y cambia a medianoche de Lima', () => {
    expect(diaEstudio(inicio, lima('2026-03-02T00:00:00'))).toBe(1);
    expect(diaEstudio(inicio, lima('2026-03-02T23:59:59'))).toBe(1);
    expect(diaEstudio(inicio, lima('2026-03-03T00:00:00'))).toBe(2);
    // 03:00 UTC del 3 de marzo todavía es 2 de marzo en Lima
    expect(diaEstudio(inicio, new Date('2026-03-03T03:00:00Z'))).toBe(1);
  });

  it('antes del inicio es 0 o negativo; después del día 7 sigue contando', () => {
    expect(diaEstudio(inicio, lima('2026-03-01T12:00:00'))).toBe(0);
    expect(diaEstudio(inicio, lima('2026-02-27T12:00:00'))).toBe(-2);
    expect(diaEstudio(inicio, lima('2026-03-08T08:00:00'))).toBe(7);
    expect(diaEstudio(inicio, lima('2026-03-10T08:00:00'))).toBe(9);
  });

  it('calcula la fecha de un día y la muestra en es-PE', () => {
    expect(fechaApertura(inicio, 1)).toBe('2026-03-02');
    expect(fechaApertura(inicio, 7)).toBe('2026-03-08');
    expect(fechaCorta('2026-04-12')).toBe('12 abr.');
    expect(fechaCorta('2026-09-01')).toBe('1 set.');
  });

  it('da el texto de fase desde calendario.json', () => {
    expect(textoFase(0, calendario.fases)).toBe('Antes del inicio');
    expect(textoFase(1, calendario.fases)).toBe('Día 1 de 7');
    expect(textoFase(7, calendario.fases)).toBe('Día 7 de 7');
    expect(textoFase(8, calendario.fases)).toBe('Estudio finalizado');
  });
});

describe('niveles', () => {
  it('asigna el rango según el XP', () => {
    expect(nivel(0, config.niveles).nombre).toBe('Recluta');
    expect(nivel(199, config.niveles).nombre).toBe('Recluta');
    expect(nivel(200, config.niveles).nombre).toBe('Agente');
    expect(nivel(450, config.niveles).nombre).toBe('Guardián');
    expect(nivel(1285, config.niveles).nombre).toBe('Guardián Una Salud');
  });

  it('calcula lo que falta y el progreso', () => {
    const n = nivel(50, config.niveles);
    expect(n.siguiente?.nombre).toBe('Agente');
    expect(n.faltan).toBe(150);
    expect(n.progreso).toBeCloseTo(0.25);
    const max = nivel(900, config.niveles);
    expect(max.siguiente).toBeNull();
    expect(max.faltan).toBe(0);
    expect(max.progreso).toBe(1);
  });

  it('nunca da XP negativo', () => {
    expect(nivel(-10, config.niveles).nombre).toBe('Recluta');
  });
});

describe('racha por días (decisión 7)', () => {
  it('cuenta hacia atrás desde hoy si hoy hubo reto', () => {
    expect(racha([1, 2, 3, 4], 4)).toBe(4);
  });

  it('cuenta desde ayer si hoy aún no hay reto', () => {
    expect(racha([1, 2, 3], 4)).toBe(3);
  });

  it('se corta con un día sin reto', () => {
    expect(racha([1, 3, 4], 4)).toBe(2);
    expect(racha([1, 2], 4)).toBe(0);
  });

  it('no cuenta antes del día 1 ni repite días', () => {
    expect(racha([0, 1], 1)).toBe(1);
    expect(racha([2, 2, 3], 3)).toBe(2);
    expect(racha([], 3)).toBe(0);
  });
});

describe('insignias', () => {
  const cfg = config.insignias as InsigniaCfg[];
  const vacio = { progreso: {}, xp: 0, racha: 0 };
  const ganadas = (e: Parameters<typeof insignias>[1]) =>
    insignias(cfg, e)
      .filter((i) => i.ganada)
      .map((i) => i.id);

  it('reconoce todas las reglas de config-juego.json', () => {
    for (const i of cfg) expect(interpretarRegla(i.regla), i.id).not.toBeNull();
    expect(cfg).toHaveLength(11);
  });

  it('sin progreso no hay insignias', () => {
    expect(ganadas(vacio)).toEqual([]);
  });

  it('Explorador con la Misión 1 completada y cualquier puntaje (decisión 5)', () => {
    const e = { ...vacio, progreso: { mision1: { estado: 'completada' as const, puntaje: 2, max: 10 } } };
    expect(ganadas(e)).toEqual(['explorador']);
  });

  it('Detective con 8/10 o más', () => {
    const e7 = { ...vacio, progreso: { mision1: { estado: 'completada' as const, puntaje: 7, max: 10 } } };
    const e8 = { ...vacio, progreso: { mision1: { estado: 'completada' as const, puntaje: 8, max: 10 } } };
    expect(ganadas(e7)).not.toContain('detective');
    expect(ganadas(e8)).toContain('detective');
  });

  it('Detective no se gana con una misión en curso', () => {
    const e = { ...vacio, progreso: { mision1: { estado: 'en_curso' as const, puntaje: 9, max: 10 } } };
    expect(ganadas(e)).toEqual([]);
  });

  it('Agente RAM con 3 decisiones responsables en la Botica', () => {
    const c = (responsable: boolean) => ({ estado: 'completada' as const, responsable });
    const dos = { ...vacio, progreso: { 'caso-botica-1': c(true), 'caso-botica-2': c(true), 'caso-botica-3': c(false) } };
    const tres = { ...vacio, progreso: { 'caso-botica-1': c(true), 'caso-botica-2': c(true), 'caso-botica-3': c(true) } };
    // Los microcasos de los retos no cuentan
    const otros = { ...vacio, progreso: { 'caso-botica-1': c(true), 'caso-botica-2': c(true), 'caso-s5': c(true) } };
    expect(ganadas(dos)).not.toContain('agente');
    expect(ganadas(otros)).not.toContain('agente');
    expect(ganadas(tres)).toContain('agente');
  });

  it('misiones de campo y encuentro 1', () => {
    const ok = { estado: 'completada' as const };
    const e = { ...vacio, progreso: { 'mision-botiquin': ok, 'mision-pasalo': ok, 'mision-campana': ok, 'enc-1': ok } };
    expect(ganadas(e)).toEqual(['auditor', 'pasalo', 'voz', 'fleming']);
    const pendiente = { ...vacio, progreso: { 'mision-botiquin': { estado: 'en_curso' as const } } };
    expect(ganadas(pendiente)).toEqual([]);
  });

  it('rachas y Guardián Una Salud', () => {
    expect(ganadas({ ...vacio, racha: 4 })).toEqual(['racha4']);
    expect(ganadas({ ...vacio, racha: 12 })).toEqual(['racha4', 'racha8', 'racha12']);
    expect(ganadas({ ...vacio, xp: 799 })).toEqual([]);
    expect(ganadas({ ...vacio, xp: 800 })).toEqual(['unasalud']);
  });

  it('una regla desconocida no se gana', () => {
    expect(interpretarRegla('algo raro')).toBeNull();
    expect(insignias([{ id: 'x', icono: '?', nombre: 'X', como: '', regla: 'algo raro' }], vacio)[0]?.ganada).toBe(false);
  });
});

describe('ranking por equipos', () => {
  const p = (equipo: Equipo | null, xp: number, extra: Partial<Parameters<typeof rankingEquipos>[0][number]> = {}) => ({
    rol: 'estudiante' as const,
    brazo: 'experimental' as const,
    equipo,
    xp,
    retirado: false,
    ...extra,
  });

  it('ordena por promedio de XP del equipo', () => {
    const r = rankingEquipos([p('E1', 100), p('E1', 200), p('E2', 300), p('E3', 50), p('E3', 60), p('E3', 70)]);
    expect(r).toEqual([
      { equipo: 'E2', promedio: 300, integrantes: 1 },
      { equipo: 'E1', promedio: 150, integrantes: 2 },
      { equipo: 'E3', promedio: 60, integrantes: 3 },
    ]);
  });

  it('excluye retirados, control, personal y sin equipo', () => {
    const r = rankingEquipos([
      p('E1', 100),
      p('E1', 900, { retirado: true }),
      p('E2', 500, { brazo: 'control' }),
      p('E3', 500, { rol: 'promotor' }),
      p('E4', 500, { rol: 'investigador' }),
      p('E5', 500, { rol: 'admin' }),
      p(null, 999),
    ]);
    expect(r).toEqual([{ equipo: 'E1', promedio: 100, integrantes: 1 }]);
  });

  it('desempata por el número de equipo', () => {
    const r = rankingEquipos([p('E4', 10), p('E2', 10)]);
    expect(r.map((x) => x.equipo)).toEqual(['E2', 'E4']);
  });

  it('las filas no tienen datos individuales', () => {
    const [fila] = rankingEquipos([p('E1', 100)]);
    expect(Object.keys(fila!).sort()).toEqual(['equipo', 'integrantes', 'promedio']);
  });
});

describe('roles', () => {
  it('solo el estudiante no es personal', () => {
    expect(ROLES.filter((r) => !esPersonal(r))).toEqual(['estudiante']);
    expect(esPersonal('investigador')).toBe(true);
    expect(esPersonal('admin')).toBe(true);
    expect(esPersonal('promotor')).toBe(true);
  });
});

describe('asignación de equipos', () => {
  it('elige el equipo con menos integrantes y desempata por el menor', () => {
    expect(equipoConMenos({})).toBe('E1');
    expect(equipoConMenos({ E1: 1 })).toBe('E2');
    expect(equipoConMenos({ E1: 2, E2: 2, E3: 1, E4: 1, E5: 2, E6: 2 })).toBe('E3');
  });

  it('12 uniones seguidas dejan 2 integrantes en cada equipo', () => {
    const conteo: Partial<Record<Equipo, number>> = {};
    for (let i = 0; i < 12; i++) {
      const e = equipoConMenos(conteo);
      conteo[e] = (conteo[e] ?? 0) + 1;
    }
    expect(conteo).toEqual({ E1: 2, E2: 2, E3: 2, E4: 2, E5: 2, E6: 2 });
  });
});

describe('semáforo', () => {
  const cfg = config.semaforo; // la función es genérica: aquí con 7/14 días
  const ahora = lima('2026-04-20T10:00:00');
  const hace = (d: number) => new Date(ahora.getTime() - d * 86_400_000);

  it('con el calendario de 1 semana: 🟢 hoy o ayer, 🟡 2–3 días, 🔴 más', () => {
    const c = calendario.semaforo;
    expect(semaforo(hace(0), ahora, c)).toEqual({ color: 'verde', dias: 0, texto: 'Hoy' });
    expect(semaforo(hace(1), ahora, c)).toEqual({ color: 'verde', dias: 1, texto: 'Hace 1 d' });
    expect(semaforo(hace(2), ahora, c).color).toBe('amarillo');
    expect(semaforo(hace(3), ahora, c).color).toBe('amarillo');
    expect(semaforo(hace(4), ahora, c)).toEqual({ color: 'rojo', dias: 4, texto: '4 d sin entrar' });
  });

  it('verde hasta 7 días', () => {
    expect(semaforo(hace(0), ahora, cfg)).toEqual({ color: 'verde', dias: 0, texto: 'Hoy' });
    expect(semaforo(hace(3), ahora, cfg)).toEqual({ color: 'verde', dias: 3, texto: 'Hace 3 d' });
    expect(semaforo(hace(7), ahora, cfg).color).toBe('verde');
  });

  it('amarillo de 8 a 14 días', () => {
    expect(semaforo(hace(8), ahora, cfg)).toEqual({ color: 'amarillo', dias: 8, texto: '8 d sin entrar' });
    expect(semaforo(hace(14), ahora, cfg).color).toBe('amarillo');
  });

  it('rojo con más de 14 días o nunca', () => {
    expect(semaforo(hace(15), ahora, cfg).color).toBe('rojo');
    expect(semaforo(hace(20), ahora, cfg)).toEqual({ color: 'rojo', dias: 20, texto: '20 d sin entrar' });
    expect(semaforo(null, ahora, cfg)).toEqual({ color: 'rojo', dias: null, texto: 'Nunca ingresó' });
  });

  it('cuenta días de calendario de Lima', () => {
    // anoche a las 23:00 en Lima → «Hace 1 d», aunque pasaron menos de 24 h
    expect(semaforo(lima('2026-04-19T23:00:00'), ahora, cfg).texto).toBe('Hace 1 d');
  });
});

describe('barajado estable', () => {
  it('el PRNG es determinista', () => {
    const a = prng(42);
    const b = prng(42);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    for (const x of xs) expect(x).toBeGreaterThanOrEqual(0);
    for (const x of xs) expect(x).toBeLessThan(1);
  });

  it('la misma semilla da el mismo orden', () => {
    expect(permutacion(10, 'uid-1|mision1')).toEqual(permutacion(10, 'uid-1|mision1'));
  });

  it('es una permutación válida', () => {
    for (const s of ['a', 'b', 'uid-xyz|caso-botica-1']) {
      expect([...permutacion(10, s)].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  });

  it('cambia entre usuarios', () => {
    const ordenes = new Set(Array.from({ length: 20 }, (_, i) => permutacion(10, `uid-${i}|mision1`).join(',')));
    expect(ordenes.size).toBeGreaterThan(15);
  });

  it('reparte las posiciones de forma razonable', () => {
    const conteo = [0, 0, 0];
    for (let i = 0; i < 3000; i++) conteo[permutacion(3, `u${i}|c`)[0]!]!++;
    for (const c of conteo) expect(c).toBeGreaterThan(850);
  });

  it('barajar no modifica el arreglo original', () => {
    const xs = ['a', 'b', 'c', 'd'];
    const ys = barajar(xs, 'semilla');
    expect(xs).toEqual(['a', 'b', 'c', 'd']);
    expect([...ys].sort()).toEqual(xs);
  });
});

describe('XP', () => {
  it('Misión 1: round(aciertos/10 × 40)', () => {
    expect(xpQuiz(0, 10, mision1.xpMaximo)).toBe(0);
    expect(xpQuiz(7, 10, mision1.xpMaximo)).toBe(28);
    expect(xpQuiz(8, 10, mision1.xpMaximo)).toBe(32);
    expect(xpQuiz(10, 10, mision1.xpMaximo)).toBe(40);
    expect(xpQuiz(12, 10, 40)).toBe(40);
  });

  it('reto: 10 × aciertos + 10 de racha', () => {
    expect(xpReto(3, false, config.xp.retoCorrecta, config.xp.rachaSemana)).toBe(30);
    expect(xpReto(2, true, config.xp.retoCorrecta, config.xp.rachaSemana)).toBe(30);
    expect(xpReto(0, true, config.xp.retoCorrecta, config.xp.rachaSemana)).toBe(10);
  });

  it('tope de 60 por acción y nunca negativo', () => {
    expect(topeXp(75, config.xp.maxPorAccion)).toBe(60);
    expect(topeXp(-5)).toBe(0);
    expect(topeXp(Number.NaN)).toBe(0);
    expect(topeXp(30)).toBe(30);
  });
});

describe('estado de módulos y siguiente misión', () => {
  const inicio = '2026-03-02'; // día 1
  const nada = () => false;
  const hechas = (...ids: string[]) => {
    const s = new Set(ids);
    return (id: string) => s.has(id);
  };
  const misiones: ModuloMin = {
    id: 'misiones',
    dia: 5,
    items: [
      { id: 'mision-botiquin', tipo: 'mision', dia: 7 },
      { id: 'mision-pasalo', tipo: 'mision', dia: 7 },
    ],
  };
  const botica: ModuloMin = {
    id: 'botica',
    dia: 2,
    items: [
      { id: 'caso-botica-1', tipo: 'caso', dia: 2 },
      { id: 'caso-botica-2', tipo: 'caso', dia: 2 },
      { id: 'caso-botica-3', tipo: 'caso', dia: 3 },
    ],
  };
  const conectar: ModuloMin = { id: 'conectar', dia: 1, items: [{ id: 'grupo-aula', tipo: 'enlace', dia: 1 }] };

  it('cerrado: «Se abre el …»', () => {
    expect(estadoModulo(botica, 1, inicio, nada)).toEqual({ tipo: 'cerrado', abre: '2026-03-03', texto: 'Se abre el 3 mar.' });
  });

  it('abierto con todo cerrado: «Próxima: …»', () => {
    expect(estadoModulo(misiones, 6, inicio, nada)).toEqual({ tipo: 'proxima', fecha: '2026-03-08', texto: 'Próxima: 8 mar.' });
  });

  it('pendientes y al día', () => {
    expect(estadoModulo(botica, 2, inicio, nada)).toMatchObject({ tipo: 'pendientes', n: 2, texto: '2 pendientes' });
    expect(estadoModulo(botica, 3, inicio, hechas('caso-botica-1', 'caso-botica-2'))).toMatchObject({ n: 1, texto: '1 pendiente' });
    expect(estadoModulo(botica, 3, inicio, hechas('caso-botica-1', 'caso-botica-2', 'caso-botica-3'))).toEqual({
      tipo: 'al_dia',
      texto: 'Al día ✓',
    });
  });

  it('un módulo solo con enlaces no queda como pendiente', () => {
    expect(estadoModulo(conectar, 1, inicio, nada).tipo).toBe('abierto');
  });

  it('siguiente misión: primera abierta y no completada, sin enlaces', () => {
    const mods = [conectar, botica, misiones];
    expect(misionDeLaSemana(mods, 0, nada)).toEqual({ tipo: 'antes_inicio' });
    expect(misionDeLaSemana(mods, 1, nada)).toEqual({ tipo: 'al_dia' });
    expect(misionDeLaSemana(mods, 2, nada)).toEqual({ tipo: 'actividad', moduloId: 'botica', actividadId: 'caso-botica-1' });
    expect(misionDeLaSemana(mods, 7, hechas('caso-botica-1', 'caso-botica-2', 'caso-botica-3'))).toEqual({
      tipo: 'actividad',
      moduloId: 'misiones',
      actividadId: 'mision-botiquin',
    });
  });
});

describe('códigos', () => {
  it('normaliza el código de aula', () => {
    expect(normalizarCodigoAula(' k7q 2px ')).toBe('K7Q2PX');
    expect(esCodigoAula('K7Q2PX')).toBe(true);
    expect(esCodigoAula('K7Q2P0')).toBe(false); // 0 no está en el alfabeto
    expect(esCodigoAula('K7Q2PI')).toBe(false); // I tampoco
    expect(esCodigoAula('K7Q2P')).toBe(false);
  });

  it('normaliza el código de asistencia', () => {
    expect(normalizarCodigoAsistencia('FLEMING6 ')).toBe(normalizarCodigoAsistencia('fleming6'));
    expect(normalizarCodigoAsistencia(' fle ming6')).toBe('FLEMING6');
  });

  it('normaliza el código de participante', () => {
    expect(normalizarCodigoParticipante(' g-7k3px ')).toBe('G-7K3PX');
    expect(normalizarCodigoParticipante('7k3px')).toBe('G-7K3PX');
    expect(esCodigoParticipante('G-7K3PX')).toBe(true);
    expect(esCodigoParticipante('G-7K3P0')).toBe(false);
  });

  it('genera códigos con el alfabeto válido', () => {
    const rnd = prng(7);
    for (let i = 0; i < 200; i++) {
      expect(esCodigoAula(generarCodigoAula(rnd))).toBe(true);
      expect(esCodigoParticipante(generarCodigoParticipante(rnd))).toBe(true);
    }
  });
});

describe('textos', () => {
  it('quita la frase inicial de juego «¡…!»', () => {
    expect(quitarExclamacionInicial('¡Decisión de Guardiana! Solo una evaluación distingue…')).toBe(
      'Solo una evaluación distingue…',
    );
    expect(quitarExclamacionInicial('¡Muy bien! Corregir con respeto también es ser Guardián.')).toBe(
      'Corregir con respeto también es ser Guardián.',
    );
    expect(quitarExclamacionInicial('Riesgoso. La mayoría de dolores…')).toBe('Riesgoso. La mayoría de dolores…');
    expect(quitarExclamacionInicial('No. Tiene ¡algo! en medio.')).toBe('No. Tiene ¡algo! en medio.');
  });

  it('reemplaza {codigo} en mensajes y enlaces', () => {
    expect(enlaceConCodigo('https://docs.google.com/forms/x/viewform?usp=pp_url&entry.123={codigo}', 'G-7K3PX')).toBe(
      'https://docs.google.com/forms/x/viewform?usp=pp_url&entry.123=G-7K3PX',
    );
    expect(config.reenganche.amarillo.replaceAll('{codigo}', 'G-7K3PX')).toContain('Hola, G-7K3PX.');
  });

  it('elige el texto de resultado de la Misión 1', () => {
    expect(textoResultado(4, 10, mision1.resultadoFinal)).toMatch(/^🔍/);
    expect(textoResultado(7, 10, mision1.resultadoFinal)).toMatch(/^🕵️/);
    expect(textoResultado(8, 10, mision1.resultadoFinal)).toMatch(/^🏅/);
    expect(textoResultado(10, 10, mision1.resultadoFinal)).toMatch(/^🏆/);
    for (let a = 0; a <= 10; a++) expect(textoResultado(a, 10, mision1.resultadoFinal)).not.toBe('');
  });
});

describe('días activos (dosis H3, decisión 7)', () => {
  it('cuenta días distintos del 1 al 7 con respuesta, completar o evidencia_enviada', () => {
    const ev = [
      { tipo: 'respuesta', dia: 1 },
      { tipo: 'completar', dia: 1 },
      { tipo: 'evidencia_enviada', dia: 3 },
      { tipo: 'ver_modulo', dia: 4 },
      { tipo: 'sesion', dia: 5 },
      { tipo: 'respuesta', dia: 0 },
      { tipo: 'completar', dia: 8 },
      { tipo: 'completar', dia: 7 },
      { tipo: 'completar', dia: null },
    ];
    expect(diasActivos(ev)).toBe(3);
  });
});
