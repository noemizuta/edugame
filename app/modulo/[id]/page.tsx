'use client';
import Link from 'next/link';
import { use } from 'react';
import { MarcoParticipante, Volver } from '@/components/participante/Marco';
import { Aviso, Cargando, Contenedor } from '@/components/ui';
import { mensajeError } from '@/lib/mensajes';
import type { moduloVista } from '@/lib/servicios/participante';
import { useDatos, useEventoUnaVez } from '@/lib/useDatos';
import { rutaPagina } from '@/lib/vista-previa-cliente';

type DatosModulo = ReturnType<typeof moduloVista>;

const MARCA: Record<string, { icono: string; texto: string }> = {
  completada: { icono: '✅', texto: 'Completada' },
  enviada: { icono: '⏳', texto: 'En revisión' },
  abierta: { icono: '▶', texto: 'Disponible' },
  cerrada: { icono: '🔒', texto: 'Cerrada' },
};

// P06 Módulo
export default function PaginaModulo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <MarcoParticipante>
      <Modulo id={id} />
    </MarcoParticipante>
  );
}

function Modulo({ id }: { id: string }) {
  const { datos, error } = useDatos<DatosModulo>(`/api/modulos/${encodeURIComponent(id)}`);
  useEventoUnaVez(datos ? { tipo: 'ver_modulo', modulo: id } : null);

  if (error) {
    const texto =
      error.codigo === 'modulo_cerrado'
        ? `Este módulo se abre el ${String(error.datos.abre ?? '')}.`
        : error.codigo === 'no_encontrado'
          ? 'Este módulo no existe.'
          : mensajeError(error.codigo, error.datos);
    return (
      <Contenedor>
        <Volver href={rutaPagina('/inicio')} texto="Inicio" />
        <div className="mt-3">
          <Aviso tono="ambar">{texto}</Aviso>
        </div>
      </Contenedor>
    );
  }
  if (!datos) return <Cargando />;
  const { modulo, actividades } = datos;

  return (
    <Contenedor>
      <Volver href={rutaPagina('/inicio')} texto="Inicio" />
      <header className={`mt-2 rounded-2xl p-4 text-tinta ${modulo.color === 'amarillo' ? 'bg-amarillo' : 'bg-cian'}`}>
        <p className="text-4xl" aria-hidden="true">
          {modulo.icono}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold">{modulo.titulo}</h1>
        {modulo.descripcion && <p className="mt-1">{modulo.descripcion}</p>}
      </header>

      <ul className="mt-4 flex flex-col gap-2">
        {actividades.map((a) => {
          const marca = MARCA[a.estado]!;
          const interior = (
            <>
              <span aria-hidden="true" className="w-7 text-center text-xl">
                {marca.icono}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug">{a.titulo}</span>
                {a.estado === 'cerrada' && <span className="block text-sm text-tinta/70">Se abre el {a.abre}</span>}
              </span>
              <span className="sr-only">{marca.texto}</span>
            </>
          );
          const clases = 'flex min-h-14 items-center gap-3 rounded-xl bg-white px-4 py-3 text-tinta shadow';
          return (
            <li key={a.id}>
              {a.estado === 'cerrada' ? (
                <div className={`${clases} opacity-60`}>{interior}</div>
              ) : (
                <Link href={rutaPagina(`/actividad/${a.id}`)} className={`${clases} hover:bg-cyan-50`}>
                  {interior}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Contenedor>
  );
}
