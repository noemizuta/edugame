'use client';
import { useState } from 'react';
import { useMarco } from '@/components/participante/Marco';
import { Aviso, Boton } from '@/components/ui';
import { ErrorCliente, llamar } from '@/lib/cliente-api';
import { mensajeError } from '@/lib/mensajes';

export interface Elegida {
  opcion: number;
  opcionCorrecta: number;
  correcta: boolean;
}

/**
 * Opciones de respuesta como tarjetas grandes (sección 15): la correcta en verde,
 * la elegida incorrecta en rojo y las demás atenuadas.
 */
export function Opciones({
  opciones,
  respuesta,
  onElegir,
  ocupado,
  nombre,
}: {
  opciones: string[];
  respuesta: Elegida | null;
  onElegir: (posicion: number) => void;
  ocupado?: boolean;
  nombre: string;
}) {
  return (
    <ul className="mt-3 flex flex-col gap-2" role="list" aria-label={nombre}>
      {opciones.map((texto, i) => {
        let estilo = 'border-tinta/15 bg-white hover:border-cian hover:bg-cyan-50';
        let marca = '';
        if (respuesta) {
          if (i === respuesta.opcionCorrecta) {
            estilo = 'border-verde bg-green-50';
            marca = '✓';
          } else if (i === respuesta.opcion) {
            estilo = 'border-rojo bg-red-50';
            marca = '✗';
          } else {
            estilo = 'border-tinta/10 bg-white opacity-55';
          }
        }
        return (
          <li key={i}>
            <button
              type="button"
              disabled={!!respuesta || ocupado}
              onClick={() => onElegir(i)}
              aria-pressed={respuesta ? i === respuesta.opcion : undefined}
              className={`flex min-h-12 w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left text-tinta transition disabled:cursor-default ${estilo}`}
            >
              <span className="flex-1">{texto}</span>
              {marca && (
                <span aria-hidden="true" className={`font-extrabold ${marca === '✓' ? 'text-verde' : 'text-rojo'}`}>
                  {marca}
                </span>
              )}
              {respuesta && i === respuesta.opcionCorrecta && <span className="sr-only">(respuesta recomendada)</span>}
              {respuesta && i === respuesta.opcion && i !== respuesta.opcionCorrecta && <span className="sr-only">(tu elección)</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Caja de retroalimentación verde (acierto) o ámbar (error). `html` solo para texto ya limpio en el servidor. */
export function Retro({ bien, titulo, texto, html }: { bien: boolean; titulo?: string; texto?: string; html?: string }) {
  return (
    <div
      role="status"
      className={`mt-3 rounded-xl border-l-4 p-3 text-tinta ${bien ? 'border-verde bg-green-50' : 'border-amarillo bg-amber-50'}`}
    >
      {titulo && <p className="font-bold">{titulo}</p>}
      {html ? <div className="contenido-html" dangerouslySetInnerHTML={{ __html: html }} /> : texto && <p>{texto}</p>}
    </div>
  );
}

/** Botón «Marcar como leído» (o «escuchado», «Ya lo respondí»): POST completar. */
export function BotonCompletar({
  actividadId,
  completada,
  texto,
  textoHecho,
  alCompletar,
}: {
  actividadId: string;
  completada: boolean;
  texto: string;
  textoHecho: string;
  alCompletar: () => void;
}) {
  const { mostrarXp } = useMarco();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (completada) {
    return (
      <p className="mt-5 rounded-xl bg-green-50 p-3 text-center font-bold text-verde" role="status">
        ✅ {textoHecho}
      </p>
    );
  }
  return (
    <>
      {error && (
        <div className="mt-3">
          <Aviso tono="rojo">{error}</Aviso>
        </div>
      )}
      <Boton
        variante="amarillo"
        className="mt-5 w-full"
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          setError(null);
          try {
            const r = await llamar<{ xpOtorgado: number }>(`/api/actividades/${actividadId}/completar`, { metodo: 'POST' });
            mostrarXp(r.xpOtorgado);
            alCompletar();
          } catch (e) {
            setError(mensajeError(e instanceof ErrorCliente ? e.codigo : ''));
          } finally {
            setOcupado(false);
          }
        }}
      >
        {ocupado ? 'Guardando…' : texto}
      </Boton>
    </>
  );
}

export const errorTexto = (e: unknown) =>
  e instanceof ErrorCliente ? mensajeError(e.codigo, e.datos) : mensajeError('');
