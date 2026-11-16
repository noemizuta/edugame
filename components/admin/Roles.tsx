'use client';
import { useEffect, useState } from 'react';
import { Aviso, Boton, Tarjeta } from '@/components/ui';
import { ErrorCliente, llamar } from '@/lib/cliente-api';
import type { Rol } from '@/lib/juego';
import { mensajeError } from '@/lib/mensajes';
import type { FilaUsuario } from '@/lib/servicios/personal';

const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  investigador: 'Investigador',
  promotor: 'Promotor',
  estudiante: 'Estudiante',
};
const ROLES: Rol[] = ['estudiante', 'promotor', 'investigador', 'admin'];

interface AulaResumen {
  id: string;
  nombre: string;
  brazo: 'experimental' | 'control';
  capacidad: number;
  activa: boolean;
  prueba?: boolean;
}

/**
 * Asignación de roles (decisión 6). Para ahorrar lecturas, la pestaña solo carga
 * las aulas; a los usuarios se los busca por correo o código, y la población
 * completa se pide a demanda.
 */
export function PanelRoles() {
  const [aulas, setAulas] = useState<AulaResumen[]>([]);
  const [usuarios, setUsuarios] = useState<FilaUsuario[] | null>(null); // población, si se pidió
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    llamar<{ aulas: AulaResumen[] }>('/api/admin/aulas')
      .then((r) => setAulas(r.aulas))
      .catch((e) => setError(mensajeError(e instanceof ErrorCliente ? e.codigo : '')));
  }, []);

  // Un cambio de rol actualiza la fila en la población (si está abierta) sin volver a leer a todos.
  const actualizar = (u: FilaUsuario) => setUsuarios((xs) => xs?.map((x) => (x.uid === u.uid ? u : x)) ?? null);

  return (
    <>
      {error && (
        <div className="mt-4">
          <Aviso tono="rojo">{error}</Aviso>
        </div>
      )}

      <Tarjeta className="rounded-tl-none">
        <h2 className="text-lg font-bold">Buscar un usuario</h2>
        <p className="mt-1 text-sm text-tinta/70">
          Toda cuenta nueva entra como estudiante. Para dar un rol, busca a la persona por su correo o por su código
          G-XXXXX y elige otro rol en su fila.
        </p>
        <Buscador aulas={aulas} alCambiar={actualizar} />
      </Tarjeta>

      <Poblacion aulas={aulas} usuarios={usuarios} setUsuarios={setUsuarios} alCambiar={actualizar} />
    </>
  );
}

const ORDEN_ROL: Record<Rol, number> = { admin: 0, investigador: 1, promotor: 2, estudiante: 3 };
const etiqueta = (u: FilaUsuario) => u.email ?? u.codigo ?? '';
const ordenar = (xs: FilaUsuario[]) =>
  xs.slice().sort((a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] || etiqueta(a).localeCompare(etiqueta(b)));

/** «Población del estudio»: todas las aulas con sus miembros y roles. Solo se lee al pedirla. */
function Poblacion({
  aulas,
  usuarios,
  setUsuarios,
  alCambiar,
}: {
  aulas: AulaResumen[];
  usuarios: FilaUsuario[] | null;
  setUsuarios: (u: FilaUsuario[] | null) => void;
  alCambiar: (u: FilaUsuario) => void;
}) {
  const [aulasPob, setAulasPob] = useState<AulaResumen[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const r = await llamar<{ aulas: AulaResumen[]; usuarios: FilaUsuario[] }>('/api/admin/poblacion');
      setAulasPob(r.aulas);
      setUsuarios(r.usuarios);
    } catch (e) {
      setError(mensajeError(e instanceof ErrorCliente ? e.codigo : ''));
    } finally {
      setCargando(false);
    }
  }

  const conAulas = (u: FilaUsuario) => u.rol === 'promotor' && u.aulasPromotor.length > 0;
  const grupos = usuarios
    ? [
        {
          id: 'sin-aula',
          titulo: 'Sin aula',
          detalle: 'Personal del estudio y estudiantes que aún no se unen',
          miembros: ordenar(usuarios.filter((u) => !u.aula && !conAulas(u))),
        },
        ...aulasPob.map((a) => ({
          id: a.id,
          titulo: a.nombre,
          detalle: `${a.brazo === 'experimental' ? 'Experimental' : 'Control'} · capacidad ${a.capacidad}${a.activa ? '' : ' · inactiva'}${a.prueba ? ' · de prueba' : ''}`,
          miembros: ordenar(usuarios.filter((u) => u.aula?.id === a.id || (u.rol === 'promotor' && u.aulasPromotor.includes(a.id)))),
        })),
      ]
    : [];

  return (
    <Tarjeta className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Población del estudio</h2>
        {usuarios && (
          <div className="flex gap-2">
            <Boton variante="claro" className="!border-tinta/30 !py-2 !text-tinta" disabled={cargando} onClick={cargar}>
              {cargando ? 'Actualizando…' : 'Actualizar'}
            </Boton>
            <Boton variante="claro" className="!border-tinta/30 !py-2 !text-tinta" onClick={() => setUsuarios(null)}>
              Ocultar
            </Boton>
          </div>
        )}
      </div>

      {!usuarios && (
        <>
          <p className="mt-1 text-sm text-tinta/70">
            Muestra todas las aulas con sus miembros y el rol de cada uno. Lee un registro por usuario (unos 400 en el
            estudio), así que úsalo solo cuando lo necesites. Los estudiantes aparecen con su código, sin correo.
          </p>
          <Boton variante="cian" className="mt-3" disabled={cargando} onClick={cargar}>
            {cargando ? 'Cargando…' : 'Mostrar población'}
          </Boton>
        </>
      )}
      {error && (
        <div className="mt-3">
          <Aviso tono="rojo">{error}</Aviso>
        </div>
      )}

      {usuarios && (
        <>
          <p className="mt-2 text-sm text-tinta/70" role="status">
            {usuarios.length} usuarios: {resumenRoles(usuarios)}.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {grupos.map((g) => (
              <details key={g.id} open={g.id === 'sin-aula'} className="rounded-xl border border-tinta/15">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-x-3 px-3 py-2 font-semibold">
                  <span>{g.titulo}</span>
                  <span className="text-sm font-normal text-tinta/70">
                    {g.detalle} · {resumenRoles(g.miembros)}
                  </span>
                </summary>
                <div className="px-3 pb-3">
                  {g.miembros.length === 0 ? (
                    <p className="text-sm text-tinta/70">Nadie por ahora.</p>
                  ) : (
                    <ul className="divide-y divide-tinta/10">
                      {g.miembros.map((u) => (
                        <FilaRol key={`${u.uid}-${u.rol}-${u.aulasPromotor.join()}`} usuario={u} aulas={aulas} alGuardar={alCambiar} />
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </Tarjeta>
  );
}

const PLURAL: Record<Rol, [string, string]> = {
  admin: ['administrador', 'administradores'],
  investigador: ['investigador', 'investigadores'],
  promotor: ['promotor', 'promotores'],
  estudiante: ['estudiante', 'estudiantes'],
};

/** «1 promotor, 28 estudiantes» (los retirados cuentan aparte). */
function resumenRoles(xs: FilaUsuario[]): string {
  const partes = (Object.keys(PLURAL) as Rol[])
    .map((rol) => [xs.filter((u) => u.rol === rol).length, PLURAL[rol]] as const)
    .filter(([c]) => c > 0)
    .map(([c, [uno, varios]]) => `${c} ${c === 1 ? uno : varios}`);
  const retirados = xs.filter((u) => u.retirado).length;
  if (retirados > 0) partes.push(`${retirados} ${retirados === 1 ? 'retirado' : 'retirados'}`);
  return partes.length ? partes.join(', ') : 'nadie';
}

function Buscador({ aulas, alCambiar }: { aulas: AulaResumen[]; alCambiar: (u: FilaUsuario) => void }) {
  const [q, setQ] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<FilaUsuario[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setBuscando(true);
    setError(null);
    try {
      setResultados((await llamar<{ usuarios: FilaUsuario[] }>(`/api/admin/usuarios?q=${encodeURIComponent(q.trim())}`)).usuarios);
    } catch (err) {
      setError(mensajeError(err instanceof ErrorCliente ? err.codigo : ''));
      setResultados(null);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <>
      <form onSubmit={buscar} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="buscar" className="sr-only">
          Buscar por correo o código
        </label>
        <input
          id="buscar"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar: correo@unac.edu.pe o G-XXXXX"
          autoComplete="off"
          className="min-h-11 flex-1 rounded-xl border-2 border-tinta/20 px-3 focus:border-cian"
        />
        <Boton type="submit" variante="cian" disabled={q.trim().length < 3 || buscando}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </Boton>
      </form>
      {error && (
        <div className="mt-2">
          <Aviso tono="rojo">{error}</Aviso>
        </div>
      )}
      {resultados?.length === 0 && <p className="mt-2 text-sm">No encontramos a nadie con ese dato.</p>}
      {resultados && resultados.length > 0 && (
        <ul className="mt-2 divide-y divide-tinta/10 rounded-xl border border-cian/60 px-3">
          {resultados.map((u) => (
            <FilaRol
              key={`${u.uid}-${u.rol}`}
              usuario={u}
              aulas={aulas}
              alGuardar={(nuevo) => {
                setResultados((xs) => xs?.map((x) => (x.uid === nuevo.uid ? nuevo : x)) ?? null);
                alCambiar(nuevo);
              }}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/** Fila con el selector de rol. Pide confirmación; para promotor, también sus aulas. */
function FilaRol({ usuario, aulas, alGuardar }: { usuario: FilaUsuario; aulas: AulaResumen[]; alGuardar: (u: FilaUsuario) => void }) {
  const [rol, setRol] = useState<Rol>(usuario.rol);
  const [aulasElegidas, setAulasElegidas] = useState<string[]>(usuario.aulasPromotor);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismasAulas = aulasElegidas.slice().sort().join() === usuario.aulasPromotor.slice().sort().join();
  const pendiente = rol !== usuario.rol || (rol === 'promotor' && !mismasAulas);
  const saleDelAula = usuario.rol === 'estudiante' && rol !== 'estudiante' && usuario.aula;
  const nombreAula = (id: string) => aulas.find((a) => a.id === id)?.nombre ?? id;

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const r = await llamar<{ usuario: FilaUsuario }>(`/api/admin/usuarios/${encodeURIComponent(usuario.uid)}/rol`, {
        metodo: 'PATCH',
        cuerpo: { rol, aulasPromotor: rol === 'promotor' ? aulasElegidas : [] },
      });
      alGuardar(r.usuario);
    } catch (e) {
      setError(mensajeError(e instanceof ErrorCliente ? e.codigo : ''));
      setGuardando(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-semibold break-all">{usuario.email ?? usuario.codigo}</p>
          <p className="text-xs text-tinta/70">
            {usuario.email ? usuario.codigo : NOMBRE_ROL[usuario.rol]}
            {usuario.rol === 'promotor' && usuario.aulasPromotor.length > 0 && ` · Aulas: ${usuario.aulasPromotor.map(nombreAula).join(', ')}`}
            {usuario.retirado ? ' · Retirado' : ''}
          </p>
        </div>
        <label className="sr-only" htmlFor={`rol-${usuario.uid}`}>
          Rol de {usuario.email ?? usuario.codigo}
        </label>
        <select
          id={`rol-${usuario.uid}`}
          value={rol}
          onChange={(e) => {
            setRol(e.target.value as Rol);
            setError(null);
          }}
          className="min-h-11 rounded-xl border-2 border-tinta/20 bg-white px-3 sm:w-44"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {NOMBRE_ROL[r]}
            </option>
          ))}
        </select>
      </div>

      {rol === 'promotor' && (
        <fieldset className="mt-2">
          <legend className="text-sm font-semibold">Aulas del promotor</legend>
          {aulas.length === 0 && <p className="text-sm text-tinta/70">Todavía no hay aulas.</p>}
          <div className="flex flex-wrap gap-x-4">
            {aulas.map((a) => (
              <label key={a.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-rosa"
                  checked={aulasElegidas.includes(a.id)}
                  onChange={(e) => setAulasElegidas((xs) => (e.target.checked ? [...xs, a.id] : xs.filter((x) => x !== a.id)))}
                />
                {a.nombre}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {pendiente && (
        <div className="mt-2 rounded-xl bg-amber-50 p-3 text-sm">
          <p>
            ¿Cambiar a <strong>{NOMBRE_ROL[rol].toLowerCase()}</strong>?
            {saleDelAula && <> Saldrá del aula «{usuario.aula!.nombre}» y su progreso no contará en el estudio.</>}
          </p>
          <div className="mt-2 flex gap-2">
            <Boton variante="rosa" className="!py-2" disabled={guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Sí, cambiar'}
            </Boton>
            <Boton
              variante="claro"
              className="!border-tinta/30 !py-2 !text-tinta"
              onClick={() => {
                setRol(usuario.rol);
                setAulasElegidas(usuario.aulasPromotor);
              }}
            >
              Cancelar
            </Boton>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-2">
          <Aviso tono="rojo">{error}</Aviso>
        </div>
      )}
    </li>
  );
}
