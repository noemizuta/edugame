'use client';
import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import { Caso, Quiz, Reto } from '@/components/actividades/juego';
import { Audio, Encuentro, Enlace, Evaluacion, Lectura, Mision } from '@/components/actividades/simples';
import { MarcoParticipante, Volver } from '@/components/participante/Marco';
import { Aviso, Cargando, Contenedor } from '@/components/ui';
import { mensajeError } from '@/lib/mensajes';
import type { VistaActividad } from '@/lib/servicios/vistas';
import { useDatos, useEventoUnaVez } from '@/lib/useDatos';
import { rutaPagina } from '@/lib/vista-previa-cliente';

// P07 Actividad (según el tipo)
export default function PaginaActividad({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <MarcoParticipante>
      <Actividad id={id} />
    </MarcoParticipante>
  );
}

function Actividad({ id }: { id: string }) {
  const router = useRouter();
  const { datos, error, recargar } = useDatos<{ actividad: VistaActividad }>(`/api/actividades/${encodeURIComponent(id)}`);
  const v = datos?.actividad;
  useEventoUnaVez(v ? { tipo: 'ver_item', actividadId: v.id } : null);

  // El microcaso de un reto se muestra dentro de su reto.
  const retoId = v?.tipo === 'caso' ? v.retoId : null;
  useEffect(() => {
    if (retoId) router.replace(rutaPagina(`/actividad/${retoId}`));
  }, [retoId, router]);

  if (error) {
    const texto =
      error.codigo === 'actividad_cerrada'
        ? `Esta actividad se abre el ${String(error.datos.abre ?? '')}.`
        : error.codigo === 'no_encontrado'
          ? 'Esta actividad no existe.'
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
  if (!v || retoId) return <Cargando />;

  return (
    <Contenedor>
      <Volver href={rutaPagina(`/modulo/${v.moduloId}`)} texto="Volver al módulo" />
      <h1 className="mt-1 mb-4 text-2xl font-extrabold">{v.titulo}</h1>
      <Contenido v={v} recargar={recargar} />
    </Contenedor>
  );
}

function Contenido({ v, recargar }: { v: VistaActividad; recargar: () => void }) {
  switch (v.tipo) {
    case 'lectura':
      return <Lectura v={v} recargar={recargar} />;
    case 'audio':
      return <Audio v={v} recargar={recargar} />;
    case 'enlace':
      return <Enlace v={v} recargar={recargar} />;
    case 'evaluacion':
      return <Evaluacion v={v} recargar={recargar} />;
    case 'encuentro':
      return <Encuentro v={v} recargar={recargar} />;
    case 'mision':
      return <Mision key={v.estado} v={v} recargar={recargar} />;
    case 'caso':
      return <Caso v={v} recargar={recargar} />;
    case 'reto':
      return <Reto v={v} recargar={recargar} />;
    case 'quiz':
      return <Quiz v={v} recargar={recargar} />;
  }
}
