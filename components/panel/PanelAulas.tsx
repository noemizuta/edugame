'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSesion } from '@/components/Sesion';
import { Aviso, Boton, Cargando, Contenedor, Tarjeta } from '@/components/ui';
import { ErrorCliente, llamar } from '@/lib/cliente-api';
import { copiar, descargar } from '@/lib/descargar';
import { EQUIPOS, type Equipo } from '@/lib/juego';
import { mensajeError } from '@/lib/mensajes';
import type { aulasDelPanel, encuentrosAula, evidenciasPendientes, participantesAula } from '@/lib/servicios/panel';
import { useDatos } from '@/lib/useDatos';

type AulaPanel = Awaited<ReturnType<typeof aulasDelPanel>>[number];
type DatosParticipantes = Awaited<ReturnType<typeof participantesAula>>;
type Participante = DatosParticipantes['participantes'][number];
type Evidencia = Awaited<ReturnType<typeof evidenciasPendientes>>[number];
type DatosEncuentros = Awaited<ReturnType<typeof encuentrosAula>>;

const CLAVE_AULA = 'edugame.panel.aula';
const EMOJI = { verde: '🟢', amarillo: '🟡', rojo: '🔴' } as const;
const TAMANO_EQUIPO = 5;

/** Texto de cada color según los umbrales de calendario.json (p. ej. «Hoy o ayer», «2 a 3 días», «Más de 3 días»). */
function leyenda(c: 'verde' | 'amarillo' | 'rojo', u: { verdeHastaDias: number; amarilloHastaDias: number }) {
  const dias = (n: number) => (n === 1 ? '1 día' : `${n} días`);
  if (c === 'verde') return u.verdeHastaDias === 1 ? 'Hoy o ayer' : `Hasta ${dias(u.verdeHastaDias)}`;
  if (c === 'amarillo') return `${u.verdeHastaDias + 1} a ${dias(u.amarilloHastaDias)}`;
  return `Más de ${dias(u.amarilloHastaDias)}`;
}

const err = (e: unknown) => (e instanceof ErrorCliente ? mensajeError(e.codigo, e.datos) : mensajeError(''));

/** Panel del promotor (PP1–PP5). Con `soloLectura`, el seguimiento del investigador. */
export function PanelAulas({ titulo, soloLectura = false }: { titulo: string; soloLectura?: boolean }) {
  const { salir, estado } = useSesion();
  const esAdmin = estado.fase === 'lista' && estado.sesion.rol === 'admin';
  const { datos, error } = useDatos<{ aulas: AulaPanel[] }>('/api/panel/aulas');
  const [aulaId, setAulaId] = useState<string | null>(null);

  useEffect(() => {
    if (!datos?.aulas.length) return;
    // ?aula=ID (desde el panel del admin) o la última elegida.
    let guardada: string | null = new URLSearchParams(window.location.search).get('aula');
    try {
      guardada ??= localStorage.getItem(CLAVE_AULA);
    } catch {
      /* sin almacenamiento */
    }
    setAulaId(datos.aulas.some((a) => a.id === guardada) ? guardada : datos.aulas[0]!.id);
  }, [datos]);

  const elegir = (id: string) => {
    setAulaId(id);
    try {
      localStorage.setItem(CLAVE_AULA, id);
    } catch {
      /* sin almacenamiento */
    }
  };

  const aula = datos?.aulas.find((a) => a.id === aulaId) ?? null;

  return (
    <Contenedor className="max-w-4xl">
      {esAdmin && (
        <Link href="/admin#aulas" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-cian">
          <span aria-hidden="true">←</span> Volver a Administración
        </Link>
      )}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{titulo}</h1>
        <button type="button" className="min-h-11 text-sm text-cian underline" onClick={() => void salir()}>
          Cerrar sesión
        </button>
      </div>
      {error && (
        <div className="mt-4">
          <Aviso tono="rojo">{err(error)}</Aviso>
        </div>
      )}
      {!datos && !error && <Cargando />}
      {datos?.aulas.length === 0 && (
        <Tarjeta className="mt-4">
          <p>Todavía no tienes aulas asignadas. Pide al administrador que te las asigne.</p>
        </Tarjeta>
      )}
      {datos && datos.aulas.length > 1 && (
        <div className="mt-4">
          <label htmlFor="aula" className="block text-sm font-semibold">
            Aula
          </label>
          <select
            id="aula"
            value={aulaId ?? ''}
            onChange={(e) => elegir(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border-2 border-white/30 bg-fondo-2 px-3 text-white"
          >
            {datos.aulas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} · {a.brazo}
              </option>
            ))}
          </select>
        </div>
      )}
      {aula && <Pestanas key={aula.id} aula={aula} soloLectura={soloLectura} />}
    </Contenedor>
  );
}

type Pestana = 'aula' | 'equipos' | 'evidencias' | 'encuentros' | 'exportar';

function Pestanas({ aula, soloLectura }: { aula: AulaPanel; soloLectura: boolean }) {
  const exp = aula.brazo === 'experimental';
  const pestanas: { id: Pestana; texto: string }[] = [
    { id: 'aula', texto: 'Mi aula' },
    ...(exp ? [{ id: 'equipos' as const, texto: 'Equipos' }, { id: 'evidencias' as const, texto: 'Evidencias' }] : []),
    { id: 'encuentros', texto: 'Encuentros' },
    { id: 'exportar', texto: 'Exportar' },
  ];
  const [actual, setActual] = useState<Pestana>('aula');

  return (
    <>
      <div role="tablist" aria-label="Secciones del panel" className="mt-4 flex gap-1 overflow-x-auto">
        {pestanas.map((p) => (
          <button
            key={p.id}
            role="tab"
            type="button"
            id={`tab-${p.id}`}
            aria-selected={actual === p.id}
            aria-controls={`panel-${p.id}`}
            onClick={() => setActual(p.id)}
            className={`min-h-11 shrink-0 rounded-t-xl px-4 font-semibold ${actual === p.id ? 'bg-white text-tinta' : 'bg-white/10 text-white'}`}
          >
            {p.texto}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${actual}`} aria-labelledby={`tab-${actual}`}>
        {actual === 'aula' && <MiAula aula={aula} />}
        {actual === 'equipos' && <Equipos aula={aula} soloLectura={soloLectura} />}
        {actual === 'evidencias' && <Evidencias aula={aula} soloLectura={soloLectura} />}
        {actual === 'encuentros' && <Encuentros aula={aula} soloLectura={soloLectura} />}
        {actual === 'exportar' && <Exportar aula={aula} />}
      </div>
    </>
  );
}

// ───────────────────────── PP1 Mi aula ─────────────────────────

function MiAula({ aula }: { aula: AulaPanel }) {
  const { datos, error } = useDatos<DatosParticipantes>(`/api/panel/aulas/${aula.id}/participantes`);
  const [copiado, setCopiado] = useState<string | null>(null);
  const exp = aula.brazo === 'experimental';

  const copiarYMarcar = async (clave: string, texto: string) => {
    if (await copiar(texto)) {
      setCopiado(clave);
      setTimeout(() => setCopiado((c) => (c === clave ? null : c)), 2000);
    }
  };

  return (
    <Tarjeta className="rounded-tl-none">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold">{aula.nombre}</h2>
          <p className="text-sm text-tinta/70">
            {aula.facultad} · Grupo {aula.brazo}
            {aula.prueba ? ' · Aula de prueba' : ''}
            {aula.activa ? '' : ' · Inactiva'}
          </p>
          <p className="mt-1 text-sm">
            {aula.inscritos}/{aula.capacidad} inscritos · {aula.fase}
          </p>
        </div>
        <div className="rounded-xl bg-tinta/5 p-3 text-center">
          <p className="text-xs font-semibold uppercase">Código de unión</p>
          <p className="font-mono text-3xl font-extrabold tracking-widest">{aula.codigoUnion}</p>
          <div className="mt-2 flex justify-center gap-2">
            <Boton variante="cian" className="!px-4 !py-2 text-sm" onClick={() => void copiarYMarcar('codigo', aula.codigoUnion)}>
              {copiado === 'codigo' ? 'Copiado ✓' : 'Copiar'}
            </Boton>
            <Link
              href={`/panel/afiche/${aula.id}`}
              target="_blank"
              className="inline-flex min-h-11 items-center rounded-full bg-amarillo px-4 py-2 text-sm font-bold text-tinta"
            >
              Imprimir afiche
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Aviso tono="rojo">{err(error)}</Aviso>
        </div>
      )}
      {!datos && !error && (
        <p className="mt-4" role="status">
          Cargando participantes…
        </p>
      )}
      {datos && (
        <>
          <ul className="mt-5 flex gap-3" aria-label="Semáforo de actividad">
            {(['verde', 'amarillo', 'rojo'] as const).map((c) => (
              <li key={c} className="flex-1 rounded-xl bg-tinta/5 p-3 text-center">
                <span className="text-2xl" aria-hidden="true">
                  {EMOJI[c]}
                </span>
                <span className="block text-2xl font-extrabold">{datos.contadores[c]}</span>
                <span className="text-xs">{leyenda(c, datos.umbrales)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">Participantes del aula</caption>
              <thead>
                <tr className="border-b border-tinta/15">
                  <th className="py-2 pr-2">Código</th>
                  {exp && <th className="py-2 pr-2">Equipo</th>}
                  {exp && <th className="py-2 pr-2 text-right">XP</th>}
                  <th className="py-2 pr-2 text-right">Días activos</th>
                  <th className="py-2 pr-2">Último acceso</th>
                  <th className="py-2">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {datos.participantes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-tinta/70">
                      Aún no se une nadie. Comparte el código o el afiche.
                    </td>
                  </tr>
                )}
                {datos.participantes.map((p) => (
                  <tr key={p.uid} className={`border-b border-tinta/10 ${p.retirado ? 'opacity-50' : ''}`}>
                    <td className="py-2 pr-2 font-mono">
                      {p.codigo}
                      {p.retirado && <span className="ml-1 font-sans text-xs">(retirado)</span>}
                    </td>
                    {exp && <td className="py-2 pr-2">{p.equipo ?? '—'}</td>}
                    {exp && <td className="py-2 pr-2 text-right">{p.xp}</td>}
                    <td className="py-2 pr-2 text-right">{p.diasActivos}</td>
                    <td className="py-2 pr-2">
                      <span aria-hidden="true">{EMOJI[p.semaforo.color]} </span>
                      {p.semaforo.texto}
                    </td>
                    <td className="py-2 text-right">
                      {p.mensaje && !p.retirado && (
                        <button
                          type="button"
                          className="min-h-11 rounded-full border border-tinta/20 px-3 text-xs font-semibold"
                          onClick={() => void copiarYMarcar(p.uid, p.mensaje!)}
                        >
                          {copiado === p.uid ? 'Copiado ✓' : 'Copiar mensaje'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-tinta/80">
            Protocolo: 🟡 → envía el mensaje. 🔴 → mensaje personal y una llamada breve.
          </p>
        </>
      )}
    </Tarjeta>
  );
}

// ───────────────────────── PP2 Equipos ─────────────────────────

function Equipos({ aula, soloLectura }: { aula: AulaPanel; soloLectura: boolean }) {
  const { datos, error, setDatos } = useDatos<DatosParticipantes>(`/api/panel/aulas/${aula.id}/participantes`);
  const [mensaje, setMensaje] = useState<{ tono: 'rojo' | 'verde'; texto: string } | null>(null);
  const activos = datos?.participantes.filter((p) => !p.retirado) ?? [];
  const conteo = Object.fromEntries(EQUIPOS.map((e) => [e, activos.filter((p) => p.equipo === e).length])) as Record<Equipo, number>;

  async function cambiar(p: Participante, equipo: Equipo) {
    setMensaje(null);
    try {
      await llamar(`/api/panel/participantes/${p.uid}/equipo`, { metodo: 'PATCH', cuerpo: { equipo } });
      setDatos((d) => d && { ...d, participantes: d.participantes.map((x) => (x.uid === p.uid ? { ...x, equipo } : x)) });
      setMensaje({ tono: 'verde', texto: `${p.codigo} ahora está en el equipo ${equipo}.` });
    } catch (e) {
      setMensaje({
        tono: 'rojo',
        texto: e instanceof ErrorCliente && e.codigo === 'equipo_lleno' ? `El equipo ${equipo} ya tiene ${TAMANO_EQUIPO} integrantes.` : err(e),
      });
    }
  }

  return (
    <Tarjeta className="rounded-tl-none">
      <p className="text-sm">Usa esta sección en la sesión presencial 1 para que los equipos de la app coincidan con los del aula. Máximo {TAMANO_EQUIPO} por equipo.</p>
      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {EQUIPOS.map((e) => (
          <li
            key={e}
            className={`rounded-xl p-2 text-center ${conteo[e] > TAMANO_EQUIPO ? 'bg-red-50 text-rojo' : 'bg-tinta/5'}`}
          >
            <span className="block font-extrabold">{e}</span>
            <span className="text-sm">
              {conteo[e]}/{TAMANO_EQUIPO}
            </span>
          </li>
        ))}
      </ul>
      {EQUIPOS.some((e) => conteo[e] > TAMANO_EQUIPO) && (
        <div className="mt-3">
          <Aviso tono="ambar">Hay equipos con más de {TAMANO_EQUIPO} integrantes.</Aviso>
        </div>
      )}
      {mensaje && (
        <div className="mt-3">
          <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
        </div>
      )}
      {error && <Aviso tono="rojo">{err(error)}</Aviso>}
      <ul className="mt-4 divide-y divide-tinta/10">
        {activos.map((p) => (
          <li key={p.uid} className="flex min-h-12 items-center justify-between gap-3 py-1">
            <span className="font-mono">{p.codigo}</span>
            {soloLectura ? (
              <span>{p.equipo ?? '—'}</span>
            ) : (
              <>
                <label className="sr-only" htmlFor={`eq-${p.uid}`}>
                  Equipo de {p.codigo}
                </label>
                <select
                  id={`eq-${p.uid}`}
                  value={p.equipo ?? ''}
                  onChange={(e) => void cambiar(p, e.target.value as Equipo)}
                  className="min-h-11 rounded-xl border-2 border-tinta/20 px-3"
                >
                  {!p.equipo && <option value="">—</option>}
                  {EQUIPOS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </>
            )}
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

// ───────────────────────── PP3 Evidencias ─────────────────────────

function Evidencias({ aula, soloLectura }: { aula: AulaPanel; soloLectura: boolean }) {
  const { datos, error, setDatos } = useDatos<{ evidencias: Evidencia[] }>(`/api/panel/evidencias?aulaId=${aula.id}`);
  return (
    <Tarjeta className="rounded-tl-none">
      {error && <Aviso tono="rojo">{err(error)}</Aviso>}
      {!datos && !error && <p role="status">Cargando…</p>}
      {datos?.evidencias.length === 0 && <p>No hay misiones pendientes de revisión. 🎉</p>}
      <ul className="flex flex-col gap-4">
        {datos?.evidencias.map((ev) => (
          <TarjetaEvidencia
            key={ev.id}
            ev={ev}
            soloLectura={soloLectura}
            alRevisar={() => setDatos((d) => d && { evidencias: d.evidencias.filter((x) => x.id !== ev.id) })}
          />
        ))}
      </ul>
    </Tarjeta>
  );
}

function TarjetaEvidencia({ ev, soloLectura, alRevisar }: { ev: Evidencia; soloLectura: boolean; alRevisar: () => void }) {
  const [comentario, setComentario] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revisar(accion: 'aprobar' | 'devolver') {
    setOcupado(true);
    setError(null);
    try {
      await llamar(`/api/panel/evidencias/${ev.id}`, { metodo: 'POST', cuerpo: { accion, comentario } });
      alRevisar();
    } catch (e) {
      setError(err(e));
      setOcupado(false);
    }
  }

  return (
    <li className="rounded-xl border-2 border-tinta/10 p-4">
      <p className="font-extrabold">{ev.mision}</p>
      <p className="text-sm text-tinta/70">
        {ev.codigo} · Equipo {ev.equipo ?? '—'} · {new Date(ev.creado).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
      </p>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        {ev.campos.map((c) => (
          <div key={c.etiqueta}>
            <dt className="font-semibold">{c.etiqueta}</dt>
            <dd className="whitespace-pre-wrap break-words">{c.valor}</dd>
          </div>
        ))}
      </dl>
      {!soloLectura && (
        <>
          <label htmlFor={`com-${ev.id}`} className="mt-3 block text-sm font-semibold">
            Comentario (obligatorio para devolver)
          </label>
          <textarea
            id={`com-${ev.id}`}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={2}
            maxLength={800}
            className="mt-1 w-full rounded-xl border-2 border-tinta/20 px-3 py-2"
          />
          {error && (
            <div className="mt-2">
              <Aviso tono="rojo">{error}</Aviso>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Boton variante="amarillo" disabled={ocupado} onClick={() => void revisar('aprobar')}>
              Aprobar · +{ev.xp} XP
            </Boton>
            <Boton
              variante="claro"
              className="!border-tinta/30 !text-tinta"
              disabled={ocupado || !comentario.trim()}
              onClick={() => void revisar('devolver')}
            >
              Devolver
            </Boton>
          </div>
        </>
      )}
    </li>
  );
}

// ───────────────────────── PP4 Encuentros ─────────────────────────

function Encuentros({ aula, soloLectura }: { aula: AulaPanel; soloLectura: boolean }) {
  const { datos, error, recargar } = useDatos<DatosEncuentros>(`/api/panel/aulas/${aula.id}/encuentros`);
  if (error) return <Aviso tono="rojo">{err(error)}</Aviso>;
  if (!datos) return <p role="status">Cargando…</p>;
  return (
    <Tarjeta className="rounded-tl-none">
      <div className="flex flex-col gap-5">
        {datos.encuentros.map((e) => (
          <FormEncuentro key={e.id} aulaId={aula.id} e={e} soloLectura={soloLectura} alGuardar={recargar} />
        ))}
        <FormGrupo aulaId={aula.id} inicial={datos.enlaceGrupo} soloLectura={soloLectura} />
      </div>
    </Tarjeta>
  );
}

function FormEncuentro({
  aulaId,
  e,
  soloLectura,
  alGuardar,
}: {
  aulaId: string;
  e: DatosEncuentros['encuentros'][number];
  soloLectura: boolean;
  alGuardar: () => void;
}) {
  const [enlace, setEnlace] = useState(e.enlace ?? '');
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: 'rojo' | 'verde'; texto: string } | null>(null);

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    setOcupado(true);
    setMensaje(null);
    try {
      const r = await llamar<{ codigoGuardado: string | null }>(`/api/panel/aulas/${aulaId}/encuentros/${e.id}`, {
        metodo: 'PUT',
        cuerpo: { enlace: enlace.trim() || null, ...(codigo.trim() ? { codigo } : {}) },
      });
      setCodigo('');
      setMensaje({
        tono: 'verde',
        texto: r.codigoGuardado
          ? `Guardado. Código de asistencia: ${r.codigoGuardado}. Anótalo: no se volverá a mostrar.`
          : 'Guardado.',
      });
      alGuardar();
    } catch (err2) {
      setMensaje({ tono: 'rojo', texto: err(err2) });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={guardar} className="rounded-xl border-2 border-tinta/10 p-4">
      <p className="font-extrabold">{e.titulo}</p>
      <p className="text-sm text-tinta/70">
        Día {e.dia} · desde el {e.fecha} · {e.codigoDefinido ? 'Código de asistencia definido ✓' : 'Sin código de asistencia'}
      </p>
      {soloLectura ? (
        <p className="mt-2 text-sm break-all">Enlace: {e.enlace ?? '—'}</p>
      ) : (
        <>
          <label htmlFor={`enl-${e.id}`} className="mt-3 block text-sm font-semibold">
            Enlace de Meet o Zoom
          </label>
          <input
            id={`enl-${e.id}`}
            type="url"
            value={enlace}
            onChange={(x) => setEnlace(x.target.value)}
            placeholder="https://meet.google.com/…"
            className="mt-1 min-h-11 w-full rounded-xl border-2 border-tinta/20 px-3"
          />
          <label htmlFor={`cod-${e.id}`} className="mt-3 block text-sm font-semibold">
            {e.codigoDefinido ? 'Nuevo código de asistencia (opcional)' : 'Código de asistencia (mínimo 4 caracteres)'}
          </label>
          <input
            id={`cod-${e.id}`}
            value={codigo}
            onChange={(x) => setCodigo(x.target.value)}
            autoComplete="off"
            className="mt-1 min-h-11 w-full rounded-xl border-2 border-tinta/20 px-3 font-mono uppercase"
          />
          {mensaje && (
            <div className="mt-2">
              <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
            </div>
          )}
          <Boton type="submit" variante="amarillo" className="mt-3" disabled={ocupado || (codigo.trim().length > 0 && codigo.trim().length < 4)}>
            {ocupado ? 'Guardando…' : 'Guardar'}
          </Boton>
        </>
      )}
    </form>
  );
}

function FormGrupo({ aulaId, inicial, soloLectura }: { aulaId: string; inicial: string | null; soloLectura: boolean }) {
  const [enlace, setEnlace] = useState(inicial ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: 'rojo' | 'verde'; texto: string } | null>(null);

  if (soloLectura) {
    return (
      <div className="rounded-xl border-2 border-tinta/10 p-4">
        <p className="font-extrabold">Grupo del aula</p>
        <p className="mt-1 text-sm break-all">{inicial ?? 'Sin enlace'}</p>
      </div>
    );
  }
  return (
    <form
      className="rounded-xl border-2 border-tinta/10 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setOcupado(true);
        setMensaje(null);
        try {
          await llamar(`/api/panel/aulas/${aulaId}`, { metodo: 'PATCH', cuerpo: { enlaceGrupo: enlace.trim() || null } });
          setMensaje({ tono: 'verde', texto: 'Guardado.' });
        } catch (x) {
          setMensaje({ tono: 'rojo', texto: err(x) });
        } finally {
          setOcupado(false);
        }
      }}
    >
      <label htmlFor="grupo" className="block font-extrabold">
        Grupo del aula (Telegram o WhatsApp)
      </label>
      <input
        id="grupo"
        type="url"
        value={enlace}
        onChange={(e) => setEnlace(e.target.value)}
        placeholder="https://t.me/… o https://chat.whatsapp.com/…"
        className="mt-1 min-h-11 w-full rounded-xl border-2 border-tinta/20 px-3"
      />
      {mensaje && (
        <div className="mt-2">
          <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
        </div>
      )}
      <Boton type="submit" variante="amarillo" className="mt-3" disabled={ocupado}>
        {ocupado ? 'Guardando…' : 'Guardar'}
      </Boton>
    </form>
  );
}

// ───────────────────────── PP5 Exportar ─────────────────────────

function Exportar({ aula }: { aula: AulaPanel }) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bajar = async (tipo: 'eventos' | 'participantes') => {
    setOcupado(tipo);
    setError(null);
    try {
      await descargar(`/api/export/${tipo}.csv?aulaId=${encodeURIComponent(aula.id)}`, `${tipo}.csv`);
    } catch (e) {
      setError(err(e));
    } finally {
      setOcupado(null);
    }
  };
  return (
    <Tarjeta className="rounded-tl-none">
      <p className="text-sm">
        Archivos CSV para Excel, sin correos ni nombres: solo los códigos anónimos. Fechas en UTC y en hora de Lima.
      </p>
      {error && (
        <div className="mt-3">
          <Aviso tono="rojo">{error}</Aviso>
        </div>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Boton variante="amarillo" disabled={!!ocupado} onClick={() => void bajar('participantes')}>
          {ocupado === 'participantes' ? 'Preparando…' : 'Participantes (CSV)'}
        </Boton>
        <Boton variante="cian" disabled={!!ocupado} onClick={() => void bajar('eventos')}>
          {ocupado === 'eventos' ? 'Preparando…' : 'Eventos (CSV)'}
        </Boton>
      </div>
    </Tarjeta>
  );
}
