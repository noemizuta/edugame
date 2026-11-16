'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Aviso, Boton, Tarjeta } from '@/components/ui';
import { ErrorCliente, llamar } from '@/lib/cliente-api';
import { copiar, descargar } from '@/lib/descargar';
import { fechaLima } from '@/lib/juego';
import { mensajeError } from '@/lib/mensajes';
import type { aulasAdmin } from '@/lib/servicios/admin';
import type { FilaUsuario } from '@/lib/servicios/personal';
import { useDatos } from '@/lib/useDatos';

export type AulaAdmin = Awaited<ReturnType<typeof aulasAdmin>>[number];
type Mensaje = { tono: 'rojo' | 'verde' | 'ambar'; texto: string } | null;

const err = (e: unknown) => (e instanceof ErrorCliente ? mensajeError(e.codigo, e.datos) : mensajeError(''));
const campo = 'mt-1 min-h-11 w-full rounded-xl border-2 border-tinta/20 bg-white px-3';

function Nota({ m }: { m: Mensaje }) {
  if (!m) return null;
  return (
    <div className="mt-3">
      <Aviso tono={m.tono}>{m.texto}</Aviso>
    </div>
  );
}

// ───────────────────────── PA1 Aulas ─────────────────────────

export function Aulas() {
  const { datos, error, recargar } = useDatos<{ aulas: AulaAdmin[] }>('/api/admin/aulas');
  return (
    <>
      <NuevaAula alCrear={recargar} />
      <Tarjeta className="mt-5">
        <h2 className="text-lg font-bold">Aulas</h2>
        {error && <Aviso tono="rojo">{err(error)}</Aviso>}
        {!datos && !error && <p role="status">Cargando…</p>}
        {datos?.aulas.length === 0 && <p className="mt-2 text-sm text-tinta/70">Todavía no hay aulas.</p>}
        <ul className="mt-3 flex flex-col gap-3">
          {datos?.aulas.map((a) => (
            <FilaAula key={`${a.id}-${a.codigoUnion}-${a.activa}-${a.fechaInicio}`} a={a} alCambiar={recargar} />
          ))}
        </ul>
      </Tarjeta>
    </>
  );
}

function NuevaAula({ alCrear }: { alCrear: () => void }) {
  const [nombre, setNombre] = useState('');
  const [facultad, setFacultad] = useState('Ciencias de la Salud');
  const [brazo, setBrazo] = useState<'experimental' | 'control'>('experimental');
  const [fechaInicio, setFechaInicio] = useState(() => fechaLima(new Date()));
  const [capacidad, setCapacidad] = useState(30);
  const [prueba, setPrueba] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);

  return (
    <Tarjeta className="rounded-tl-none">
      <h2 className="text-lg font-bold">Crear aula</h2>
      <form
        className="mt-2 grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setOcupado(true);
          setMsg(null);
          try {
            const r = await llamar<{ aula: AulaAdmin }>('/api/admin/aulas', {
              metodo: 'POST',
              cuerpo: { nombre, facultad, brazo, fechaInicio, capacidad, prueba },
            });
            setMsg({ tono: 'verde', texto: `Aula creada. Código de unión: ${r.aula.codigoUnion}` });
            setNombre('');
            alCrear();
          } catch (x) {
            setMsg({ tono: 'rojo', texto: err(x) });
          } finally {
            setOcupado(false);
          }
        }}
      >
        <label className="text-sm font-semibold">
          Nombre del aula
          <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={80} placeholder="Enfermería 7A" />
        </label>
        <label className="text-sm font-semibold">
          Facultad
          <input className={campo} value={facultad} onChange={(e) => setFacultad(e.target.value)} required minLength={2} maxLength={80} />
        </label>
        <fieldset className="text-sm font-semibold">
          <legend>Grupo del estudio</legend>
          <div className="mt-1 flex gap-4">
            {(['experimental', 'control'] as const).map((b) => (
              <label key={b} className="flex min-h-11 items-center gap-2 font-normal">
                <input type="radio" name="brazo" className="size-5 accent-rosa" checked={brazo === b} onChange={() => setBrazo(b)} />
                {b === 'experimental' ? 'Experimental (con juego)' : 'Control (sin juego)'}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="text-sm font-semibold">
          Fecha de inicio (día 1 del estudio)
          <input type="date" className={campo} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
        </label>
        <label className="text-sm font-semibold">
          Capacidad
          <input type="number" min={1} max={30} className={campo} value={capacidad} onChange={(e) => setCapacidad(Number(e.target.value))} />
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm font-semibold">
          <input type="checkbox" className="size-5 accent-rosa" checked={prueba} onChange={(e) => setPrueba(e.target.checked)} />
          Aula de prueba (no sale en las exportaciones por defecto)
        </label>
        <div className="sm:col-span-2">
          <Boton type="submit" variante="amarillo" disabled={ocupado || nombre.trim().length < 2}>
            {ocupado ? 'Creando…' : 'Crear aula'}
          </Boton>
          <Nota m={msg} />
        </div>
      </form>
    </Tarjeta>
  );
}

function FilaAula({ a, alCambiar }: { a: AulaAdmin; alCambiar: () => void }) {
  const [fecha, setFecha] = useState(a.fechaInicio);
  const [confirmar, setConfirmar] = useState<'codigo' | 'fecha' | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);

  async function cambiar(cuerpo: Record<string, unknown>) {
    setOcupado(true);
    setMsg(null);
    try {
      await llamar(`/api/admin/aulas/${a.id}`, { metodo: 'PATCH', cuerpo });
      setConfirmar(null);
      alCambiar();
    } catch (x) {
      setMsg({ tono: 'rojo', texto: err(x) });
      setOcupado(false);
    }
  }

  return (
    <li className={`rounded-xl border-2 p-4 ${a.activa ? 'border-tinta/10' : 'border-dashed border-tinta/30 opacity-75'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-extrabold">
            {a.nombre}
            {a.prueba && <span className="ml-2 rounded-full bg-tinta/10 px-2 py-0.5 text-xs font-semibold">prueba</span>}
            {!a.activa && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-rojo">inactiva</span>}
          </p>
          <p className="text-sm text-tinta/70">
            {a.facultad} · {a.brazo} · {a.inscritos}/{a.capacidad} · inicio {a.fechaInicio} · {a.fase}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-extrabold tracking-widest">{a.codigoUnion}</p>
          <button type="button" className="min-h-11 text-sm text-tinta underline" onClick={() => void copiar(a.codigoUnion)}>
            Copiar código
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/panel?aula=${a.id}`} className="inline-flex min-h-11 items-center rounded-full bg-amarillo px-4 text-sm font-bold">
          Ver aula
        </Link>
        <Boton variante="claro" className="!border-tinta/30 !py-2 text-sm !text-tinta" disabled={ocupado} onClick={() => void cambiar({ activa: !a.activa })}>
          {a.activa ? 'Desactivar' : 'Activar'}
        </Boton>
        <Boton variante="claro" className="!border-tinta/30 !py-2 text-sm !text-tinta" onClick={() => setConfirmar(confirmar === 'codigo' ? null : 'codigo')}>
          Regenerar código
        </Boton>
        <Boton variante="claro" className="!border-tinta/30 !py-2 text-sm !text-tinta" onClick={() => setConfirmar(confirmar === 'fecha' ? null : 'fecha')}>
          Cambiar fecha de inicio
        </Boton>
      </div>
      {confirmar === 'codigo' && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
          <p>El código actual dejará de funcionar (también en los afiches impresos). ¿Generar uno nuevo?</p>
          <Boton variante="rosa" className="mt-2 !py-2" disabled={ocupado} onClick={() => void cambiar({ regenerarCodigo: true })}>
            Sí, regenerar
          </Boton>
        </div>
      )}
      {confirmar === 'fecha' && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
          <label className="font-semibold">
            Nueva fecha de inicio (día 1)
            <input type="date" className={campo} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <p className="mt-1">Cambia el día del estudio de todo el aula (y los días que se registran desde ahora).</p>
          <Boton variante="rosa" className="mt-2 !py-2" disabled={ocupado || fecha === a.fechaInicio} onClick={() => void cambiar({ fechaInicio: fecha })}>
            Guardar fecha
          </Boton>
        </div>
      )}
      <Nota m={msg} />
    </li>
  );
}

// ───────────────────────── PA4 Participantes ─────────────────────────

export function Participantes() {
  const { datos: aulas } = useDatos<{ aulas: AulaAdmin[] }>('/api/admin/aulas');
  const [q, setQ] = useState('');
  const [res, setRes] = useState<FilaUsuario[] | null>(null);
  const [msg, setMsg] = useState<Mensaje>(null);
  const [ocupado, setOcupado] = useState(false);

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    setOcupado(true);
    setMsg(null);
    try {
      setRes((await llamar<{ usuarios: FilaUsuario[] }>(`/api/admin/usuarios?q=${encodeURIComponent(q.trim())}`)).usuarios);
    } catch (x) {
      setMsg({ tono: 'rojo', texto: err(x) });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Tarjeta className="rounded-tl-none">
      <h2 className="text-lg font-bold">Buscar participante</h2>
      <p className="text-sm text-tinta/70">Por código G-XXXXX o por correo. Ver el correo queda registrado.</p>
      <form onSubmit={buscar} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="buscar-part" className="sr-only">
          Código o correo
        </label>
        <input id="buscar-part" value={q} onChange={(e) => setQ(e.target.value)} placeholder="G-XXXXX o correo" className={`${campo} !mt-0 flex-1`} />
        <Boton type="submit" variante="cian" disabled={q.trim().length < 3 || ocupado}>
          Buscar
        </Boton>
      </form>
      <Nota m={msg} />
      {res?.length === 0 && <p className="mt-3 text-sm">No encontramos a nadie con ese dato.</p>}
      <ul className="mt-3 flex flex-col gap-3">
        {res?.map((u) => (
          <FichaParticipante key={`${u.uid}-${u.aula?.id}-${u.retirado}`} u={u} aulas={aulas?.aulas ?? []} alCambiar={() => void buscar()} />
        ))}
      </ul>
    </Tarjeta>
  );
}

function FichaParticipante({ u, aulas, alCambiar }: { u: FilaUsuario; aulas: AulaAdmin[]; alCambiar: () => void }) {
  const [destino, setDestino] = useState('');
  const [confirmar, setConfirmar] = useState<'mover' | 'retirar' | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);
  const aulaDestino = aulas.find((a) => a.id === destino);
  const aulaActual = aulas.find((a) => a.id === u.aula?.id);
  const cambiaBrazo = aulaDestino && aulaActual && aulaDestino.brazo !== aulaActual.brazo;

  async function accion(ruta: string, cuerpo: Record<string, unknown>, ok: string) {
    setOcupado(true);
    setMsg(null);
    try {
      await llamar(ruta, { metodo: 'POST', cuerpo });
      setMsg({ tono: 'verde', texto: ok });
      setConfirmar(null);
      alCambiar();
    } catch (x) {
      setMsg({ tono: 'rojo', texto: err(x) });
    } finally {
      setOcupado(false);
    }
  }

  if (u.rol !== 'estudiante') {
    return (
      <li className="rounded-xl border-2 border-tinta/10 p-4 text-sm">
        <p className="font-semibold break-all">{u.email}</p>
        <p>Es parte del personal ({u.rol}). Su rol se cambia en «Usuarios y roles».</p>
      </li>
    );
  }
  return (
    <li className="rounded-xl border-2 border-tinta/10 p-4">
      <p className="font-semibold break-all">{u.email}</p>
      <p className="text-sm text-tinta/70">
        {u.codigo} · {u.aula ? `Aula ${u.aula.nombre}` : 'Sin aula'}
        {u.retirado && <strong className="ml-1 text-rojo">· Retirado</strong>}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-semibold">
          Mover a otra aula
          <select className={campo} value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Elige un aula</option>
            {aulas
              .filter((a) => a.id !== u.aula?.id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} · {a.brazo} · {a.inscritos}/{a.capacidad}
                </option>
              ))}
          </select>
        </label>
        <Boton variante="amarillo" disabled={!destino} onClick={() => setConfirmar('mover')}>
          Mover
        </Boton>
        <Boton variante="claro" className="!border-rojo !text-rojo" onClick={() => setConfirmar('retirar')}>
          {u.retirado ? 'Reactivar' : 'Marcar como retirado'}
        </Boton>
      </div>
      {confirmar === 'mover' && aulaDestino && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
          <p>
            ¿Mover a {u.codigo} a «{aulaDestino.nombre}»? Conserva su progreso.
            {cambiaBrazo && <strong> Cambia de grupo ({aulaActual!.brazo} → {aulaDestino.brazo}): esto afecta los datos del estudio.</strong>}
          </p>
          <Boton
            variante="rosa"
            className="mt-2 !py-2"
            disabled={ocupado}
            onClick={() => void accion(`/api/admin/participantes/${u.uid}/mover`, { aulaId: destino }, 'Movido.')}
          >
            Sí, mover
          </Boton>
        </div>
      )}
      {confirmar === 'retirar' && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
          <p>
            {u.retirado
              ? '¿Reactivar a este participante? Podrá volver a usar la app.'
              : 'Ya no podrá usar la app, saldrá del ranking y quedará marcado como retirado en los CSV. ¿Continuar?'}
          </p>
          <Boton
            variante="rosa"
            className="mt-2 !py-2"
            disabled={ocupado}
            onClick={() =>
              void accion(`/api/admin/participantes/${u.uid}/retirar`, { retirado: !u.retirado }, u.retirado ? 'Reactivado.' : 'Marcado como retirado.')
            }
          >
            Sí, continuar
          </Boton>
        </div>
      )}
      <Nota m={msg} />
    </li>
  );
}

// ───────────────────────── PA5 Configuración ─────────────────────────

const ETIQUETAS: Record<string, string> = {
  o1: 'Cuestionario inicial (O1)',
  o2: 'Cuestionario intermedio (O2)',
  satisfaccion: 'Encuesta de satisfacción',
  o3: 'Cuestionario final (O3)',
  servicioMedico: 'Servicio médico (página o contacto)',
};

export function Configuracion() {
  const { datos, error } = useDatos<{ enlaces: Record<string, string | null> }>('/api/admin/config');
  if (error) return <Aviso tono="rojo">{err(error)}</Aviso>;
  if (!datos) return <p role="status">Cargando…</p>;
  return <FormConfig inicial={datos.enlaces} />;
}

function FormConfig({ inicial }: { inicial: Record<string, string | null> }) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.keys(ETIQUETAS).map((k) => [k, inicial[k] ?? ''])),
  );
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);
  return (
    <Tarjeta className="rounded-tl-none">
      <h2 className="text-lg font-bold">Enlaces del estudio</h2>
      <p className="mt-1 text-sm text-tinta/70">
        Para que el formulario se abra con el código del participante ya escrito, usa el enlace prellenado de Google Forms y
        reemplaza el valor de ejemplo por <code className="rounded bg-tinta/10 px-1">{'{codigo}'}</code>. Ejemplo:
        <span className="block break-all font-mono text-xs">…/viewform?usp=pp_url&amp;entry.123456={'{codigo}'}</span>
      </p>
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setOcupado(true);
          setMsg(null);
          try {
            const enlaces = Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v.trim() || null]));
            await llamar('/api/admin/config', { metodo: 'PUT', cuerpo: { enlaces } });
            setMsg({ tono: 'verde', texto: 'Guardado.' });
          } catch (x) {
            setMsg({ tono: 'rojo', texto: err(x) });
          } finally {
            setOcupado(false);
          }
        }}
      >
        {Object.entries(ETIQUETAS).map(([k, etiqueta]) => (
          <label key={k} className="text-sm font-semibold">
            {etiqueta}
            <input
              type="url"
              className={campo}
              value={valores[k] ?? ''}
              onChange={(e) => setValores((v) => ({ ...v, [k]: e.target.value }))}
              placeholder="https://docs.google.com/forms/…"
            />
          </label>
        ))}
        <div>
          <Boton type="submit" variante="amarillo" disabled={ocupado}>
            {ocupado ? 'Guardando…' : 'Guardar'}
          </Boton>
          <Nota m={msg} />
        </div>
      </form>
    </Tarjeta>
  );
}

// ───────────────────────── PA7 Exportar ─────────────────────────

export function Exportar() {
  const { datos } = useDatos<{ aulas: AulaAdmin[] }>('/api/admin/aulas');
  const [aulaId, setAulaId] = useState('');
  const [incluirPrueba, setIncluirPrueba] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<Mensaje>(null);

  const bajar = async (tipo: 'eventos' | 'participantes') => {
    setOcupado(tipo);
    setMsg(null);
    const params = new URLSearchParams();
    if (aulaId) params.set('aulaId', aulaId);
    if (!aulaId && incluirPrueba) params.set('incluirPrueba', '1');
    try {
      await descargar(`/api/export/${tipo}.csv?${params}`, `${tipo}.csv`);
    } catch (x) {
      setMsg({ tono: 'rojo', texto: err(x) });
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Tarjeta className="rounded-tl-none">
      <h2 className="text-lg font-bold">Exportar datos (CSV)</h2>
      <p className="mt-1 text-sm text-tinta/70">Sin correos ni nombres: solo los códigos anónimos. Fechas en UTC y en hora de Lima.</p>
      <label className="mt-3 block text-sm font-semibold">
        Aula
        <select className={campo} value={aulaId} onChange={(e) => setAulaId(e.target.value)}>
          <option value="">Todas las aulas</option>
          {datos?.aulas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre} · {a.brazo}
              {a.prueba ? ' · prueba' : ''}
            </option>
          ))}
        </select>
      </label>
      {!aulaId && (
        <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-rosa" checked={incluirPrueba} onChange={(e) => setIncluirPrueba(e.target.checked)} />
          Incluir aulas de prueba
        </label>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Boton variante="amarillo" disabled={!!ocupado} onClick={() => void bajar('participantes')}>
          {ocupado === 'participantes' ? 'Preparando…' : 'Participantes (CSV)'}
        </Boton>
        <Boton variante="cian" disabled={!!ocupado} onClick={() => void bajar('eventos')}>
          {ocupado === 'eventos' ? 'Preparando…' : 'Eventos (CSV)'}
        </Boton>
      </div>
      <Nota m={msg} />
    </Tarjeta>
  );
}

// ───────────────────────── PA6 Vista previa ─────────────────────────

export function VistaPreviaLanzador() {
  const [brazo, setBrazo] = useState<'experimental' | 'control'>('experimental');
  const [dia, setDia] = useState(1);
  return (
    <Tarjeta className="rounded-tl-none">
      <h2 className="text-lg font-bold">Vista previa del participante</h2>
      <p className="mt-1 text-sm text-tinta/70">
        Recorre la app como un estudiante ficticio. Puedes responder: verás la retroalimentación, pero no se guarda nada.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Grupo
          <select className={campo} value={brazo} onChange={(e) => setBrazo(e.target.value as 'experimental' | 'control')}>
            <option value="experimental">Experimental (con juego)</option>
            <option value="control">Control (sin juego)</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Día del estudio
          <select className={campo} value={dia} onChange={(e) => setDia(Number(e.target.value))}>
            <option value={0}>Antes del inicio</option>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d <= 7 ? `Día ${d}` : 'Después del cierre'}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Link
        href={`/vista-previa/inicio?brazo=${brazo}&dia=${dia}`}
        className="mt-4 inline-flex min-h-11 items-center rounded-full bg-rosa px-6 font-bold text-white"
      >
        Abrir vista previa ▶
      </Link>
    </Tarjeta>
  );
}
