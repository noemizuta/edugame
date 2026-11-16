'use client';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useMarco } from '@/components/participante/Marco';
import { Aviso, Boton, Tarjeta } from '@/components/ui';
import { llamar } from '@/lib/cliente-api';
import type { VistaActividad, VistaCasoControl, VistaCasoExp, VistaQuiz } from '@/lib/servicios/vistas';
import { BotonCompletar, Opciones, Retro, errorTexto } from './comunes';

type V<T extends VistaActividad['tipo']> = Extract<VistaActividad, { tipo: T }>;

// ───────────────────────── Caso (experimental) ─────────────────────────

interface RespuestaCaso {
  opcion: number;
  opcionCorrecta: number;
  correcta: boolean;
  feedback: string;
  feedbackCorrecta?: string;
}

export function CasoJuego({ v, titulo }: { v: VistaCasoExp & { id: string }; titulo?: string }) {
  const { mostrarXp } = useMarco();
  const inicial: RespuestaCaso | null = v.respuesta
    ? {
        opcion: v.respuesta.opcion,
        opcionCorrecta: v.respuesta.opcionResponsable,
        correcta: v.respuesta.responsable,
        feedback: v.respuesta.feedback,
        feedbackCorrecta: v.respuesta.feedbackResponsable,
      }
    : null;
  const [resp, setResp] = useState<RespuestaCaso | null>(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function elegir(opcion: number) {
    setOcupado(true);
    setError(null);
    try {
      const r = await llamar<RespuestaCaso & { xpOtorgado: number }>(`/api/actividades/${v.id}/responder`, {
        metodo: 'POST',
        cuerpo: { opcion },
      });
      setResp(r);
      mostrarXp(r.xpOtorgado);
    } catch (e) {
      setError(errorTexto(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Tarjeta>
      {titulo && <h2 className="mb-2 text-lg font-extrabold">{titulo}</h2>}
      <p className="leading-relaxed">{v.texto}</p>
      <p className="mt-4 font-bold">{v.pregunta}</p>
      {!resp && <p className="text-sm text-tinta/70">Cuenta tu primera decisión.</p>}
      <Opciones opciones={v.opciones} respuesta={resp} onElegir={elegir} ocupado={ocupado} nombre="Opciones del caso" />
      {error && (
        <div className="mt-3">
          <Aviso tono="rojo">{error}</Aviso>
        </div>
      )}
      {resp && (
        <>
          <Retro bien={resp.correcta} texto={resp.feedback} />
          {!resp.correcta && resp.feedbackCorrecta && <Retro bien titulo="Lo recomendable" texto={resp.feedbackCorrecta} />}
        </>
      )}
    </Tarjeta>
  );
}

// ───────────────────────── Caso comentado (control) ─────────────────────────

export function CasoComentado({ v, titulo }: { v: VistaCasoControl; titulo?: string }) {
  return (
    <Tarjeta>
      {titulo && <h2 className="mb-2 text-lg font-extrabold">{titulo}</h2>}
      <p className="leading-relaxed">{v.texto}</p>
      <div className="mt-4 rounded-xl border-l-4 border-verde bg-green-50 p-3">
        <p>
          <strong>Lo recomendable:</strong> {v.recomendable}
        </p>
        <p className="mt-1">{v.explicacion}</p>
      </div>
      <h3 className="mt-4 font-bold">Por qué no las otras opciones</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {v.otras.map((o) => (
          <li key={o.texto} className="rounded-xl bg-tinta/5 p-3">
            <p className="font-semibold">{o.texto}</p>
            <p className="mt-1 text-sm">{o.explicacion}</p>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

export function Caso({ v, recargar }: { v: V<'caso'>; recargar: () => void }) {
  if (v.modo === 'juego') return <CasoJuego v={v} />;
  return (
    <>
      <CasoComentado v={v} />
      <BotonCompletar actividadId={v.id} completada={v.completada} texto="Marcar como leído" textoHecho="Leído" alCompletar={recargar} />
    </>
  );
}

// ───────────────────────── Reto ─────────────────────────

interface RespuestaPregunta {
  opcion: number;
  opcionCorrecta: number;
  correcta: boolean;
  veredicto: string;
  explicacion: string;
}

type PreguntaJuego = Extract<V<'reto'>, { modo: 'juego' }>['preguntas'][number];

function Pregunta({
  retoId,
  p,
  n,
  alResponder,
}: {
  retoId: string;
  p: PreguntaJuego;
  n: number;
  alResponder: (r: { completada: boolean; xpOtorgado: number }) => void;
}) {
  const [resp, setResp] = useState<RespuestaPregunta | null>(p.respuesta);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function elegir(opcion: number) {
    setOcupado(true);
    setError(null);
    try {
      const r = await llamar<RespuestaPregunta & { feedback: string; completada: boolean; xpOtorgado: number }>(
        `/api/actividades/${retoId}/responder`,
        { metodo: 'POST', cuerpo: { pregunta: p.clave, opcion } },
      );
      setResp({ ...r, explicacion: r.feedback });
      alResponder(r);
    } catch (e) {
      setError(errorTexto(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Tarjeta>
      <p className="text-sm font-bold text-tinta/70">Pregunta {n} de 3</p>
      <p className="mt-1 text-lg font-bold">{p.texto}</p>
      <Opciones opciones={p.opciones} respuesta={resp} onElegir={elegir} ocupado={ocupado} nombre={`Opciones de la pregunta ${n}`} />
      {error && (
        <div className="mt-3">
          <Aviso tono="rojo">{error}</Aviso>
        </div>
      )}
      {resp && <Retro bien={resp.correcta} titulo={resp.veredicto} texto={resp.explicacion} />}
    </Tarjeta>
  );
}

export function Reto({ v, recargar }: { v: V<'reto'>; recargar: () => void }) {
  const { mostrarXp } = useMarco();
  const [xpFinal, setXpFinal] = useState<number | null>(v.modo === 'juego' ? v.xp : null);

  if (v.modo === 'lectura') {
    return (
      <>
        <p className="mb-3 text-white/85">Lectura: {v.tema}</p>
        <div className="flex flex-col gap-3">
          {v.preguntas.map((p, i) => (
            <Tarjeta key={i}>
              <p className="font-bold">{p.texto}</p>
              <p className="mt-2 rounded-xl border-l-4 border-verde bg-green-50 p-3">
                <strong>Respuesta:</strong> {p.respuesta}
              </p>
              <p className="mt-2">{p.explicacion}</p>
            </Tarjeta>
          ))}
          <CasoComentado v={v.caso} titulo="Caso" />
        </div>
        <BotonCompletar actividadId={v.id} completada={v.completada} texto="Marcar como leído" textoHecho="Leído" alCompletar={recargar} />
      </>
    );
  }

  return (
    <>
      <p className="mb-3 text-white/85">3 preguntas y un microcaso. Cuenta tu primer intento.</p>
      <div className="flex flex-col gap-3">
        {v.preguntas.map((p, i) => (
          <Pregunta
            key={p.clave}
            retoId={v.id}
            p={p}
            n={i + 1}
            alResponder={(r) => {
              if (r.completada) {
                setXpFinal(r.xpOtorgado);
                mostrarXp(r.xpOtorgado);
              }
            }}
          />
        ))}
        {xpFinal !== null && (
          <p className="rounded-xl bg-amarillo p-3 text-center font-extrabold text-tinta" role="status">
            Reto completado · +{xpFinal} XP
          </p>
        )}
        <CasoJuego v={v.caso} titulo="Microcaso" />
      </div>
    </>
  );
}

// ───────────────────────── Misión 1 (quiz) ─────────────────────────

type CasoQuiz = VistaQuiz['casos'][number];
interface RespuestaQuiz {
  opcion: number;
  opcionCorrecta: number;
  correcta: boolean;
  feedback: string;
  feedbackCorrecta?: string;
}

export function Quiz({ v }: { v: V<'quiz'>; recargar: () => void }) {
  const { mostrarXp } = useMarco();
  const [casos, setCasos] = useState<CasoQuiz[]>(v.casos);
  const [resultado, setResultado] = useState(v.resultado);
  const [pantalla, setPantalla] = useState<'intro' | 'juego' | 'resultado' | 'practica'>(
    v.estado === 'en_curso' ? 'juego' : 'intro',
  );

  if (pantalla === 'intro') {
    return (
      <Tarjeta>
        <Image
          src={v.intro.imagen}
          alt="Portada de la Misión 1: Detectives del Antibiótico"
          width={1280}
          height={720}
          className="h-auto w-full rounded-xl"
          priority
        />
        <h2 className="mt-4 text-xl font-extrabold">{v.intro.titulo}</h2>
        {v.intro.parrafos.map((p) => (
          <p key={p} className="mt-2 leading-relaxed">
            {p}
          </p>
        ))}
        {resultado ? (
          <>
            <p className="mt-4 rounded-xl bg-amber-50 p-3 font-semibold">
              Tu primer resultado: {resultado.aciertos}/{resultado.total}. Puedes repetir para practicar; los puntos ya se contaron.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Boton variante="amarillo" onClick={() => setPantalla('practica')}>
                Repetir la misión
              </Boton>
              <Boton variante="cian" onClick={() => setPantalla('resultado')}>
                Ver mi resultado
              </Boton>
            </div>
          </>
        ) : (
          <Boton variante="rosa" className="mt-5 w-full" onClick={() => setPantalla('juego')}>
            {v.intro.boton}
          </Boton>
        )}
      </Tarjeta>
    );
  }

  if (pantalla === 'resultado' && resultado) {
    return <ResultadoQuiz resultado={resultado} casos={casos} volver={() => setPantalla('intro')} />;
  }

  if (pantalla === 'practica') return <Practica casos={v.casos} terminar={() => setPantalla('intro')} />;

  return (
    <Recorrido
      casos={casos}
      modo="normal"
      alResponder={(id, r, final) => {
        setCasos((cs) => cs.map((c) => (c.id === id ? { ...c, respuesta: r } : c)));
        if (final) {
          setResultado(final);
          mostrarXp(final.xp);
        }
      }}
      alTerminar={() => setPantalla('resultado')}
    />
  );
}

/** Recorre los casos desde el primero sin responder. No se puede volver atrás. */
function Recorrido({
  casos,
  modo,
  alResponder,
  alTerminar,
}: {
  casos: CasoQuiz[];
  modo: 'normal' | 'practica';
  alResponder: (id: string, r: RespuestaQuiz, final: VistaQuiz['resultado']) => void;
  alTerminar: () => void;
}) {
  const primero = useMemo(() => {
    const i = casos.findIndex((c) => !c.respuesta);
    return i === -1 ? casos.length - 1 : i;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [indice, setIndice] = useState(primero);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const caso = casos[indice]!;
  const resp = caso.respuesta;
  const ultimo = indice === casos.length - 1;

  async function elegir(opcion: number) {
    setOcupado(true);
    setError(null);
    try {
      const r = await llamar<RespuestaQuiz & { resultado?: VistaQuiz['resultado'] }>('/api/actividades/mision1/responder', {
        metodo: 'POST',
        cuerpo: { pregunta: caso.id, opcion, modo },
      });
      alResponder(caso.id, r, r.resultado ?? null);
    } catch (e) {
      setError(errorTexto(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Tarjeta>
      <p className="text-sm font-bold text-tinta/70">
        {modo === 'practica' ? 'Práctica · ' : ''}Caso {indice + 1} de {casos.length}
      </p>
      <h2 className="mt-1 text-lg font-extrabold">{caso.titulo}</h2>
      <p className="mt-2 leading-relaxed">{caso.escena}</p>
      <p className="mt-3 font-bold">{caso.pregunta}</p>
      <Opciones opciones={caso.opciones} respuesta={resp} onElegir={elegir} ocupado={ocupado} nombre={`Opciones del caso ${indice + 1}`} />
      {error && (
        <div className="mt-3">
          <Aviso tono="rojo">{error}</Aviso>
        </div>
      )}
      {resp && (
        <>
          <Retro bien={resp.correcta} html={resp.feedback} />
          {!resp.correcta && resp.feedbackCorrecta && <Retro bien titulo="La respuesta correcta" html={resp.feedbackCorrecta} />}
          <Boton variante="rosa" className="mt-4 w-full" onClick={() => (ultimo ? alTerminar() : setIndice(indice + 1))}>
            {ultimo ? 'Ver resultado' : 'Siguiente'}
          </Boton>
        </>
      )}
    </Tarjeta>
  );
}

function ResultadoQuiz({
  resultado,
  casos,
  volver,
}: {
  resultado: NonNullable<VistaQuiz['resultado']>;
  casos: CasoQuiz[];
  volver: () => void;
}) {
  return (
    <Tarjeta>
      <h2 className="text-xl font-extrabold">
        Resultado de la misión: {resultado.aciertos} de {resultado.total} casos resueltos
      </h2>
      <p className="mt-3 leading-relaxed">{resultado.texto}</p>
      <table className="mt-4 w-full text-left text-sm">
        <caption className="sr-only">Casos de la misión y tu resultado</caption>
        <thead>
          <tr className="border-b border-tinta/15">
            <th className="py-2 pr-2">Caso</th>
            <th className="py-2 text-center">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {casos.map((c, i) => (
            <tr key={c.id} className="border-b border-tinta/10">
              <td className="py-2 pr-2">
                {i + 1}. {c.titulo}
              </td>
              <td className="py-2 text-center text-lg">
                {c.respuesta?.correcta ? (
                  <span className="text-verde" aria-label="Correcto">
                    ✓
                  </span>
                ) : (
                  <span className="text-rojo" aria-label="Incorrecto">
                    ✗
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 rounded-xl bg-amarillo p-3 text-center font-extrabold">+{resultado.xp} XP</p>
      {resultado.detective && (
        <p className="mt-3 rounded-xl bg-green-50 p-3 text-center font-bold text-verde">🕵️ Insignia: Detective del Antibiótico</p>
      )}
      <Boton variante="cian" className="mt-4 w-full" onClick={volver}>
        Volver a la misión
      </Boton>
    </Tarjeta>
  );
}

function Practica({ casos, terminar }: { casos: CasoQuiz[]; terminar: () => void }) {
  const [lista, setLista] = useState<CasoQuiz[]>(() => casos.map((c) => ({ ...c, respuesta: null })));
  const [fin, setFin] = useState(false);
  if (fin) {
    const aciertos = lista.filter((c) => c.respuesta?.correcta).length;
    return (
      <Tarjeta>
        <h2 className="text-xl font-extrabold">
          Práctica: {aciertos} de {lista.length}
        </h2>
        <p className="mt-2">Los puntos ya se contaron con tu primer intento.</p>
        <Boton variante="cian" className="mt-4 w-full" onClick={terminar}>
          Volver a la misión
        </Boton>
      </Tarjeta>
    );
  }
  return (
    <Recorrido
      casos={lista}
      modo="practica"
      alResponder={(id, r) => setLista((cs) => cs.map((c) => (c.id === id ? { ...c, respuesta: r } : c)))}
      alTerminar={() => setFin(true)}
    />
  );
}
