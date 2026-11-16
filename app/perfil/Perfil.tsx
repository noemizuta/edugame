'use client';
import { useState } from 'react';
import type { DatosYo } from '@/lib/tipos-cliente';
import { AvisoDerivacion, MarcoParticipante } from '@/components/participante/Marco';
import { useSesion } from '@/components/Sesion';
import { Aviso, Boton, Cargando, Contenedor, Tarjeta } from '@/components/ui';
import { llamar } from '@/lib/cliente-api';
import { mensajeError } from '@/lib/mensajes';
import { useDatos } from '@/lib/useDatos';
import { vistaPrevia } from '@/lib/vista-previa-cliente';
import { errorTexto } from '@/components/actividades/comunes';

export function Perfil({ avatares }: { avatares: string[] }) {
  return (
    <MarcoParticipante>
      <Contenido avatares={avatares} />
    </MarcoParticipante>
  );
}

function Contenido({ avatares }: { avatares: string[] }) {
  const { salir } = useSesion();
  const { datos, error, recargar } = useDatos<DatosYo>('/api/yo');
  if (error) {
    return (
      <Contenedor>
        <Aviso tono="rojo">{mensajeError(error.codigo, error.datos)}</Aviso>
      </Contenedor>
    );
  }
  if (!datos) return <Cargando />;
  const j = datos.juego;

  return (
    <Contenedor>
      <h1 className="text-2xl font-extrabold">Mi perfil</h1>

      <Tarjeta className="mt-4">
        <div className="flex items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-full border-4 border-cian bg-fondo text-4xl" aria-hidden="true">
            {datos.perfil.avatar}
          </span>
          <dl className="text-sm">
            <div>
              <dt className="inline font-semibold">Código: </dt>
              <dd className="inline font-mono text-base">{datos.perfil.codigo}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Aula: </dt>
              <dd className="inline">{datos.aula.nombre}</dd>
            </div>
            {j && (
              <div>
                <dt className="inline font-semibold">Equipo: </dt>
                <dd className="inline">{j.equipo}</dd>
              </div>
            )}
          </dl>
        </div>
        <CambiarAvatar avatares={avatares} actual={datos.perfil.avatar} alGuardar={recargar} />
      </Tarjeta>

      {j && (
        <>
          <Tarjeta className="mt-4">
            <h2 className="text-lg font-extrabold">Mi progreso</h2>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-tinta/5 p-2">
                <dt className="text-xs">XP</dt>
                <dd className="text-xl font-extrabold">{j.xp}</dd>
              </div>
              <div className="rounded-xl bg-tinta/5 p-2">
                <dt className="text-xs">Rango</dt>
                <dd className="font-extrabold leading-tight">{j.nivel.nombre}</dd>
              </div>
              <div className="rounded-xl bg-tinta/5 p-2">
                <dt className="text-xs">Racha</dt>
                <dd className="text-xl font-extrabold">🔥 {j.racha}</dd>
              </div>
            </dl>
          </Tarjeta>

          <Tarjeta className="mt-4">
            <h2 className="text-lg font-extrabold">Insignias</h2>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {j.insignias.map((i) => (
                <li
                  key={i.id}
                  className={`flex items-center gap-3 rounded-xl border-2 p-3 ${i.ganada ? 'border-amarillo bg-amber-50' : 'border-tinta/10 opacity-60'}`}
                >
                  <span className={`text-3xl ${i.ganada ? '' : 'grayscale'}`} aria-hidden="true">
                    {i.icono}
                  </span>
                  <span>
                    <span className="block font-bold">{i.nombre}</span>
                    <span className="block text-sm">{i.como}</span>
                    <span className="sr-only">{i.ganada ? 'Ganada' : 'Bloqueada'}</span>
                  </span>
                  {!i.ganada && (
                    <span className="ml-auto" aria-hidden="true">
                      🔒
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Tarjeta>
        </>
      )}

      <AvisoDerivacion texto={datos.derivacion} />
      {!vistaPrevia() && (
        <div className="mt-6 text-center">
          <Boton variante="claro" onClick={() => void salir()}>
            Cerrar sesión
          </Boton>
        </div>
      )}
    </Contenedor>
  );
}

function CambiarAvatar({ avatares, actual, alGuardar }: { avatares: string[]; actual: string | null; alGuardar: () => void }) {
  const { actualizar } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState(actual);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!abierto) {
    return (
      <button type="button" className="mt-3 min-h-11 text-sm font-semibold text-tinta underline" onClick={() => setAbierto(true)}>
        Cambiar avatar
      </button>
    );
  }
  return (
    <fieldset className="mt-4">
      <legend className="font-bold">Elige tu avatar</legend>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {avatares.map((a) => (
          <label
            key={a}
            className={`flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 text-3xl has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-cian ${
              elegido === a ? 'border-cian bg-cyan-50' : 'border-tinta/10'
            }`}
          >
            <input type="radio" name="avatar" className="sr-only" checked={elegido === a} onChange={() => setElegido(a)} />
            <span aria-hidden="true">{a}</span>
            <span className="sr-only">Avatar {a}</span>
          </label>
        ))}
      </div>
      {error && (
        <div className="mt-2">
          <Aviso tono="rojo">{error}</Aviso>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Boton
          variante="amarillo"
          disabled={!elegido || elegido === actual || ocupado}
          onClick={async () => {
            setOcupado(true);
            try {
              await llamar('/api/perfil', { metodo: 'PATCH', cuerpo: { avatar: elegido } });
              actualizar((s) => ({ ...s, perfil: { ...s.perfil, avatar: elegido } }));
              setAbierto(false);
              alGuardar();
            } catch (e) {
              setError(errorTexto(e));
            } finally {
              setOcupado(false);
            }
          }}
        >
          Guardar
        </Boton>
        <Boton variante="claro" className="!border-tinta/30 !text-tinta" onClick={() => setAbierto(false)}>
          Cancelar
        </Boton>
      </div>
    </fieldset>
  );
}
