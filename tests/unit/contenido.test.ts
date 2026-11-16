import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ErrorContenido, catalogo, construirCatalogo, limpiarHtml, modulosDelBrazo } from '@/lib/contenido';
import { interpretarRegla, estadoModulo } from '@/lib/juego';

const leer = (f: string) => JSON.parse(readFileSync(new URL(`../../content/${f}`, import.meta.url), 'utf8'));
const fuentes = () => ({
  modulos: leer('modulos.json'),
  retos: leer('retos.json'),
  mision1: leer('mision1.json'),
  config: leer('config-juego.json'),
  calendario: leer('calendario.json'),
});

/** Construye el catálogo con una modificación y devuelve los problemas. */
function problemas(modificar: (f: ReturnType<typeof fuentes>) => void): string[] {
  const f = fuentes();
  modificar(f);
  try {
    construirCatalogo(f);
    return [];
  } catch (e) {
    if (e instanceof ErrorContenido) return e.problemas;
    throw e;
  }
}

describe('contenidos del kit', () => {
  it('pasan la validación', () => {
    expect(() => catalogo()).not.toThrow();
  });

  it('content/ es una copia exacta de kit/contenido/ (si el kit está presente)', () => {
    for (const f of ['modulos.json', 'retos.json', 'mision1.json', 'config-juego.json']) {
      let original: Buffer;
      try {
        original = readFileSync(new URL(`../../kit/contenido/${f}`, import.meta.url));
      } catch {
        continue; // en CI el kit no existe
      }
      const copia = readFileSync(new URL(`../../content/${f}`, import.meta.url));
      expect(createHash('sha256').update(copia).digest('hex'), f).toBe(createHash('sha256').update(original).digest('hex'));
    }
  });

  it('tiene 9 módulos, 12 retos con su microcaso y 10 casos en la Misión 1', () => {
    const c = catalogo();
    expect(c.modulos).toHaveLength(9);
    const retos = c.modulos.find((m) => m.id === 'retos')!;
    expect(retos.items.filter((a) => a.tipo === 'reto').map((a) => a.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => `reto-s${i + 5}`),
    );
    expect(retos.items.filter((a) => a.tipo === 'caso').map((a) => a.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => `caso-s${i + 5}`),
    );
    expect(c.mision1.casos).toHaveLength(10);
  });

  it('genera el título del reto como «Reto K · {tema}» (decisión 7)', () => {
    const r = catalogo().actividades.get('reto-s6')!.actividad;
    expect(r.tipo).toBe('reto');
    expect(r.semana).toBe(6);
    expect(r.titulo).toBe(`Reto 2 · ${leer('retos.json').retos[1].tema}`);
    expect(catalogo().actividades.get('caso-s6')!.actividad.titulo).toBe('Reto 2 · Microcaso');
  });

  it('los ID son únicos y sin puntos', () => {
    const c = catalogo();
    const ids = [
      ...c.modulos.map((m) => m.id),
      ...c.modulos.flatMap((m) => m.items.map((a) => a.id)),
      ...c.mision1.casos.map((x) => x.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).not.toMatch(/[./]/);
  });

  it('las semanas del kit siguen entre 0 y 18 y los días de apertura dentro de la semana del estudio', () => {
    const dur = catalogo().calendario.duracionDias;
    for (const m of catalogo().modulos) {
      expect(m.semana).toBeGreaterThanOrEqual(0);
      expect(m.semana).toBeLessThanOrEqual(18);
      for (const a of m.items) {
        expect(a.semana).toBeGreaterThanOrEqual(0);
        expect(a.semana).toBeLessThanOrEqual(18);
        expect(a.dia).toBeGreaterThanOrEqual(1);
        expect(a.dia).toBeLessThanOrEqual(dur);
      }
    }
  });

  it('calendario.json ajusta semáforo, fases, racha y textos sin tocar config-juego.json', () => {
    const c = catalogo();
    expect(c.config.semaforo).toEqual({ verdeHastaDias: 1, amarilloHastaDias: 3 });
    expect(c.config.fases[1]!.texto).toBe('Día {n} de 7');
    expect(c.config.insignias.find((i) => i.id === 'racha4')).toMatchObject({ nombre: 'Racha 3', regla: 'racha >= 3' });
    expect(c.modulos.find((m) => m.id === 'retos')).toMatchObject({ titulo: 'Retos', tituloControl: 'Temas' });
    expect(leer('config-juego.json').semaforo).toEqual({ verdeHastaDias: 7, amarilloHastaDias: 14 });
  });

  it('todas las reglas de insignias se reconocen', () => {
    for (const i of catalogo().config.insignias) expect(interpretarRegla(i.regla), i.id).not.toBeNull();
  });

  it('el HTML queda solo con etiquetas permitidas', () => {
    const c = catalogo();
    const htmls = [
      ...c.modulos.flatMap((m) => m.items).flatMap((a) => (a.tipo === 'lectura' ? [a.html] : [])),
      ...c.mision1.casos.flatMap((x) => x.opciones.map((o) => o.feedback)),
    ];
    for (const h of htmls) {
      for (const [, tag] of h.matchAll(/<\/?([a-z0-9]+)/gi)) expect(['p', 'strong', 'em', 'ul', 'ol', 'li', 'b', 'i']).toContain(tag);
    }
    // La retroalimentación de m1-c08 conserva su <em> (DECISIONES, observaciones)
    expect(c.mision1.casos.find((x) => x.id === 'm1-c08')!.opciones.some((o) => o.feedback.includes('<em>'))).toBe(true);
  });

  it('el control no ve Misión 1, Caso Callao 2050 ni Misiones de campo', () => {
    const control = modulosDelBrazo('control');
    const ids = control.map((m) => m.id);
    expect(ids).not.toContain('caso');
    expect(ids).not.toContain('misiones');
    const actividades = control.flatMap((m) => m.items.map((a) => a.id));
    expect(actividades).not.toContain('mision1');
    expect(actividades).toContain('lec-control-10-mitos');
    expect(modulosDelBrazo('experimental').flatMap((m) => m.items.map((a) => a.id))).not.toContain('lec-control-10-mitos');
  });
});

describe('apertura con el calendario de 1 semana (decisión 7)', () => {
  const inicio = '2026-03-02'; // día 1
  const cerrados = (dia: number) =>
    modulosDelBrazo('experimental')
      .flatMap((m) => m.items)
      .filter((a) => a.dia > dia)
      .map((a) => a.id);

  it('el día 1 todo está abierto salvo O2, satisfacción y O3, que abren el día 7', () => {
    expect(cerrados(1).sort()).toEqual(['eval-o2', 'eval-o3', 'eval-sat']);
    expect(cerrados(7)).toEqual([]);
    const evals = modulosDelBrazo('experimental').find((m) => m.id === 'evaluaciones')!;
    expect(estadoModulo(evals, 1, inicio, (id) => id === 'eval-o1').tipo).toBe('proxima');
  });

  it('antes del inicio (día 0) todos los módulos están cerrados', () => {
    for (const m of modulosDelBrazo('experimental')) expect(estadoModulo(m, 0, inicio, () => false).tipo, m.id).toBe('cerrado');
  });
});

describe('validación de calendario.json', () => {
  it('rechaza una apertura de una actividad inexistente o fuera de la semana', () => {
    expect(problemas((f) => void (f.calendario.aperturas['no-existe'] = 2)).join()).toMatch(/la actividad no existe/);
    expect(problemas((f) => void (f.calendario.aperturas['eval-o3'] = 9)).join()).toMatch(/pasa de duracionDias/);
  });
});

describe('validación (sección 10)', () => {
  it('rechaza un ID repetido', () => {
    expect(
      problemas((f) => {
        f.modulos.modulos[0].items[1].id = 'mision1';
      }).join(),
    ).toMatch(/ID repetido «mision1»/);
  });

  it('rechaza un ID con puntos', () => {
    expect(
      problemas((f) => {
        f.modulos.modulos[0].items[1].id = 'lec.virus';
      }).join(),
    ).toMatch(/sin puntos/);
  });

  it('rechaza una semana fuera de 0–18', () => {
    expect(problemas((f) => void (f.modulos.modulos[0].items[1].semana = 19)).length).toBeGreaterThan(0);
    expect(problemas((f) => void (f.modulos.modulos[0].semana = -1)).length).toBeGreaterThan(0);
    expect(problemas((f) => void (f.retos.retos[0].semana = 20)).length).toBeGreaterThan(0);
  });

  it('rechaza un reto sin exactamente 3 preguntas', () => {
    expect(problemas((f) => void f.retos.retos[0].preguntas.pop()).join()).toMatch(/exactamente 3 preguntas/);
  });

  it('rechaza una «correcta» fuera de rango', () => {
    expect(problemas((f) => void (f.retos.retos[2].preguntas[1].correcta = 3)).join()).toMatch(/fuera de rango/);
  });

  it('rechaza un caso sin exactamente una opción responsable', () => {
    expect(
      problemas((f) => {
        f.modulos.modulos[1].items[0].opciones[0].responsable = true;
      }).join(),
    ).toMatch(/exactamente una opción responsable/);
    expect(
      problemas((f) => {
        for (const o of f.retos.retos[0].caso.opciones) o.responsable = false;
      }).join(),
    ).toMatch(/exactamente una opción responsable/);
  });

  it('rechaza un caso de la Misión 1 sin exactamente una correcta', () => {
    expect(
      problemas((f) => {
        f.mision1.casos[3].opciones[0].correcta = true;
        f.mision1.casos[3].opciones[1].correcta = true;
      }).join(),
    ).toMatch(/exactamente una opción correcta/);
  });

  it('rechaza una misión sin campos', () => {
    expect(
      problemas((f) => {
        const misiones = f.modulos.modulos.find((m: { id: string }) => m.id === 'misiones');
        misiones.items[0].campos = [];
      }).join(),
    ).toMatch(/Una misión debe tener campos/);
  });

  it('rechaza una semana de reto repetida', () => {
    expect(problemas((f) => void (f.retos.retos[1].semana = 5)).join()).toMatch(/semana 5 se repite/);
  });

  it('rechaza claves desconocidas (p. ej. una errata)', () => {
    expect(problemas((f) => void (f.modulos.modulos[1].items[0].opciones[0].responsible = true)).length).toBeGreaterThan(0);
  });
});

describe('limpieza de HTML', () => {
  it('quita etiquetas, atributos y scripts no permitidos', () => {
    expect(limpiarHtml('<p onclick="x()">Hola <script>alert(1)</script><a href="http://x">enlace</a></p>')).toBe(
      '<p>Hola enlace</p>',
    );
    expect(limpiarHtml('<p><img src=x onerror=alert(1)><strong>ok</strong></p>')).toBe('<p><strong>ok</strong></p>');
  });
});
