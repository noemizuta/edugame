import { describe, expect, it } from 'vitest';
import { catalogo, modulosDelBrazo } from '@/lib/contenido';
import { permutacion } from '@/lib/juego';
import { vistaActividad } from '@/lib/servicios/vistas';

const PROHIBIDAS = /"(correcta|responsable|feedback|opcionCorrecta|opcionResponsable)"\s*:/;

function vistasSinProgreso(brazo: 'experimental' | 'control') {
  return modulosDelBrazo(brazo).flatMap((m) =>
    m.items.map((a) => ({
      a,
      json: JSON.stringify(
        vistaActividad(a, { uid: 'uid-prueba', codigo: 'G-AAAAA', brazo, moduloId: m.id, progreso: null, progresoCaso: null }),
      ),
    })),
  );
}

describe('criterio 6: sin respuestas en el navegador antes de responder', () => {
  it('experimental: ninguna vista sin progreso trae claves de respuesta', () => {
    for (const { a, json } of vistasSinProgreso('experimental')) expect(json, a.id).not.toMatch(PROHIBIDAS);
  });

  it('experimental: ninguna vista trae la retroalimentación ni las explicaciones', () => {
    const c = catalogo();
    const secretos = [
      ...c.modulos.flatMap((m) => m.items).flatMap((a) => (a.tipo === 'caso' ? a.opciones.map((o) => o.feedback) : [])),
      ...c.modulos.flatMap((m) => m.items).flatMap((a) => (a.tipo === 'reto' ? a.preguntas.map((p) => p.explicacion) : [])),
      ...c.mision1.casos.flatMap((x) => x.opciones.map((o) => o.feedback)),
    ];
    for (const { a, json } of vistasSinProgreso('experimental')) {
      for (const s of secretos) expect(json.includes(JSON.stringify(s).slice(1, -1)), `${a.id}: ${s.slice(0, 40)}`).toBe(false);
    }
  });

  it('control: tampoco hay claves de respuesta (los casos comentados usan «recomendable» y «explicacion»)', () => {
    for (const { a, json } of vistasSinProgreso('control')) expect(json, a.id).not.toMatch(PROHIBIDAS);
  });

  it('un caso respondido sí devuelve el resultado guardado, en las posiciones mostradas', () => {
    const caso = catalogo().actividades.get('caso-botica-1')!.actividad;
    if (caso.tipo !== 'caso') throw new Error('tipo');
    const original = caso.opciones.findIndex((o) => o.responsable);
    const v = vistaActividad(caso, {
      uid: 'u1',
      codigo: 'G-AAAAA',
      brazo: 'experimental',
      moduloId: 'botica',
      progreso: {
        estado: 'completada',
        xp: 15,
        respuestas: { caso: { opcion: original, correcta: true, en: null as never } },
        completadaEn: null,
      },
    });
    if (v.tipo !== 'caso' || v.modo !== 'juego') throw new Error('vista');
    const perm = permutacion(3, 'u1|caso-botica-1');
    expect(v.respuesta).toMatchObject({ responsable: true, opcion: perm.indexOf(original), opcionResponsable: perm.indexOf(original) });
    expect(v.opciones[v.respuesta!.opcion]).toBe(caso.opciones[original]!.texto);
  });
});

describe('control: caso comentado y lectura de la semana', () => {
  it('quita la frase inicial de juego «¡…!» de la retroalimentación', () => {
    const caso = catalogo().actividades.get('caso-botica-1')!.actividad;
    const v = vistaActividad(caso, { uid: 'u', codigo: 'G-AAAAA', brazo: 'control', moduloId: 'botica', progreso: null });
    if (v.tipo !== 'caso' || v.modo !== 'comentado') throw new Error('vista');
    expect(v.explicacion.startsWith('¡')).toBe(false);
    expect(v.explicacion).toMatch(/^Solo una evaluación distingue/);
    expect(v.otras).toHaveLength(2);
  });

  it('el reto se muestra con sus respuestas correctas, explicaciones y el caso recomendable', () => {
    const reto = catalogo().actividades.get('reto-s6')!.actividad;
    const v = vistaActividad(reto, { uid: 'u', codigo: 'G-AAAAA', brazo: 'control', moduloId: 'retos', progreso: null });
    if (v.tipo !== 'reto' || v.modo !== 'lectura') throw new Error('vista');
    expect(v.preguntas).toHaveLength(3);
    if (reto.tipo !== 'reto') throw new Error('tipo');
    expect(v.preguntas[0]!.respuesta).toBe(reto.preguntas[0]!.opciones[reto.preguntas[0]!.correcta]);
    expect(v.caso.modo).toBe('comentado');
  });
});

describe('Misión 1', () => {
  it('10 casos en orden estable por usuario y distinto entre usuarios', () => {
    const quiz = catalogo().actividades.get('mision1')!.actividad;
    const orden = (uid: string) => {
      const v = vistaActividad(quiz, { uid, codigo: 'G-AAAAA', brazo: 'experimental', moduloId: 'lab', progreso: null });
      if (v.tipo !== 'quiz') throw new Error('vista');
      return v.casos.map((c) => c.id);
    };
    expect(orden('a')).toHaveLength(10);
    expect(orden('a')).toEqual(orden('a'));
    expect(new Set(['a', 'b', 'c', 'd'].map((u) => orden(u).join())).size).toBeGreaterThan(1);
  });
});
