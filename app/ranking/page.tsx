'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { MarcoParticipante, useMarco } from '@/components/participante/Marco';
import { Aviso, Cargando, Contenedor, Tarjeta } from '@/components/ui';
import { mensajeError } from '@/lib/mensajes';
import type { FilaRanking } from '@/lib/juego';
import { useDatos } from '@/lib/useDatos';
import { rutaPagina } from '@/lib/vista-previa-cliente';

const MEDALLAS = ['🥇', '🥈', '🥉'];

// P09 Ranking (solo experimental: el control vuelve a Inicio)
export default function PaginaRanking() {
  return (
    <MarcoParticipante>
      <Ranking />
    </MarcoParticipante>
  );
}

function Ranking() {
  const { experimental } = useMarco();
  const router = useRouter();
  useEffect(() => {
    if (!experimental) router.replace(rutaPagina('/inicio'));
  }, [experimental, router]);
  if (!experimental) return <Cargando />;
  return <Tabla />;
}

function Tabla() {
  const { datos, error } = useDatos<{ equipos: FilaRanking[]; miEquipo: string | null }>('/api/ranking');
  if (error) {
    return (
      <Contenedor>
        <Aviso tono="rojo">{mensajeError(error.codigo, error.datos)}</Aviso>
      </Contenedor>
    );
  }
  if (!datos) return <Cargando />;
  return (
    <Contenedor>
      <h1 className="text-2xl font-extrabold">Ranking de equipos</h1>
      <p className="mt-1 text-sm text-white/80">XP promedio de cada equipo de tu aula.</p>
      <Tarjeta className="mt-4">
        {datos.equipos.length === 0 ? (
          <p>Aún no hay equipos con integrantes.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {datos.equipos.map((e, i) => {
              const mio = e.equipo === datos.miEquipo;
              return (
                <li
                  key={e.equipo}
                  aria-current={mio ? 'true' : undefined}
                  className={`flex items-center gap-3 rounded-xl border-2 p-3 ${mio ? 'border-cian bg-cyan-50' : 'border-tinta/10'}`}
                >
                  <span className="w-8 text-center text-2xl" aria-hidden="true">
                    {MEDALLAS[i] ?? `${i + 1}.`}
                  </span>
                  <span className="flex-1">
                    <span className="block font-extrabold">
                      Equipo {e.equipo}
                      {mio && <span className="ml-2 rounded-full bg-cian px-2 py-0.5 text-xs">Tu equipo</span>}
                    </span>
                    <span className="block text-sm">
                      {e.integrantes} {e.integrantes === 1 ? 'integrante' : 'integrantes'}
                    </span>
                  </span>
                  <span className="text-lg font-extrabold">
                    {e.promedio} <span className="text-sm font-semibold">XP</span>
                  </span>
                  <span className="sr-only">Puesto {i + 1}</span>
                </li>
              );
            })}
          </ol>
        )}
      </Tarjeta>
      <p className="mt-4 text-center text-sm text-white/80">No hay ranking individual: aquí gana el trabajo en equipo.</p>
    </Contenedor>
  );
}
