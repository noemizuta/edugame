/**
 * Genera docs/REVISION_CONTENIDO.md (decisión 1): las frases con tono de juego
 * que ve el grupo CONTROL, para que el equipo de investigación las revise.
 * No modifica ningún contenido.
 *
 *   npm run revision-contenido
 */
import { writeFileSync } from 'node:fs';
import { type Actividad, catalogo, configJuego, modulosDelBrazo } from '@/lib/contenido';
import { fechaLima, quitarExclamacionInicial } from '@/lib/juego';

const PATRONES: [RegExp, string][] = [
  [/guardi[aá]n(a|es)?/i, 'Guardián/Guardiana'],
  [/\bmisi[oó]n(es)?\b/i, 'misión'],
  [/\bpistas?\b/i, 'pista'],
  [/\bdetectives?\b/i, 'detective'],
  [/\bagentes?\b/i, 'agente'],
  [/\binsignias?\b/i, 'insignia'],
  [/\bXP\b|\bpuntos?\b/i, 'puntos/XP'],
  [/\bequipos?\b/i, 'equipo'],
  [/\branking\b/i, 'ranking'],
  [/callao 2050/i, 'Callao 2050'],
  [/\bnivel \d/i, 'nivel'],
  [/¡[^!¡]+!/, '¡…! (exclamación)'],
];

interface Hallazgo {
  donde: string;
  campo: string;
  texto: string;
  marcas: string[];
}

const hallazgos: Hallazgo[] = [];
const sinHtml = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function revisar(donde: string, campo: string, texto: string) {
  const marcas = PATRONES.filter(([re]) => re.test(texto)).map(([, n]) => n);
  if (marcas.length) hallazgos.push({ donde, campo, texto, marcas });
}

function revisarActividad(a: Actividad, modulo: string) {
  const donde = `${modulo} → \`${a.id}\``;
  revisar(donde, 'título', a.titulo);
  switch (a.tipo) {
    case 'lectura':
      revisar(donde, 'texto', sinHtml(a.html));
      break;
    case 'caso':
      revisar(donde, 'escena', a.texto);
      for (const o of a.opciones) {
        revisar(donde, o.responsable ? 'opción recomendable' : 'otra opción', o.texto);
        revisar(donde, 'explicación (sin el «¡…!» inicial)', quitarExclamacionInicial(o.feedback));
      }
      break;
    case 'reto':
      revisar(donde, 'tema', a.tema);
      for (const p of a.preguntas) {
        revisar(donde, 'pregunta', p.texto);
        revisar(donde, 'respuesta', p.opciones[p.correcta]!);
        revisar(donde, 'explicación', p.explicacion);
      }
      break;
    default:
      break;
  }
}

const cfg = configJuego();
for (const m of modulosDelBrazo('control')) {
  const titulo = m.tituloControl ?? m.titulo;
  revisar(`Módulo \`${m.id}\``, 'título que ve el control', titulo);
  if (m.descripcionControl) revisar(`Módulo \`${m.id}\``, 'descripción (control)', m.descripcionControl);
  for (const a of m.items) revisarActividad(a, titulo);
}
revisar('Textos generales', 'consentimiento', cfg.consentimiento.texto);
revisar('Textos generales', 'aviso de derivación', cfg.derivacion);

const escapar = (s: string) => s.replace(/\|/g, '\\|');
const fecha = fechaLima(new Date());
const md = `# Revisión de contenido: tono de juego visible para el grupo control

Generado por \`npm run revision-contenido\` el ${fecha} (decisión 1 de \`docs/DECISIONES.md\`). **No se modificó ningún contenido.**

El grupo control ve los mismos contenidos **sin elementos de juego** (regla 1). La app ya:
- muestra \`tituloControl\` en los módulos que lo tienen y oculta las descripciones de módulo (ningún módulo tiene \`descripcionControl\`);
- oculta la Misión 1, el Caso Callao 2050 y las Misiones de campo;
- quita la frase inicial «¡…!» de la retroalimentación de los casos.

Lo que sigue son textos que el control **sí ve** y que contienen palabras o frases con posible tono de juego. Para cada uno, el equipo de investigación puede decidir: dejarlo, pedir una versión para el control (por ejemplo, un campo \`textoControl\`) o cambiarlo para ambos brazos.

Total: **${hallazgos.length}** textos.

| Dónde | Campo | Marca | Texto |
|---|---|---|---|
${hallazgos.map((h) => `| ${escapar(h.donde)} | ${h.campo} | ${h.marcas.join(', ')} | ${escapar(h.texto)} |`).join('\n')}
`;

writeFileSync(new URL('../docs/REVISION_CONTENIDO.md', import.meta.url), md);
console.log(`docs/REVISION_CONTENIDO.md: ${hallazgos.length} textos para revisar`);
