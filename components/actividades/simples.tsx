'use client';
import { useState } from 'react';
import { useMarco } from '@/components/participante/Marco';
import { Aviso, Boton, Tarjeta } from '@/components/ui';
import { llamar } from '@/lib/cliente-api';
import type { VistaActividad } from '@/lib/servicios/vistas';
import { registrarEvento } from '@/lib/useDatos';
import { BotonCompletar, errorTexto } from './comunes';

type V<T extends VistaActividad['tipo']> = Extract<VistaActividad, { tipo: T }>;
interface Props<T extends VistaActividad['tipo']> {
  v: V<T>;
  recargar: () => void;
}

const enlaceExterno = 'inline-flex min-h-11 items-center justify-center rounded-full bg-rosa px-6 py-3 font-bold text-white';

export function Lectura({ v, recargar }: Props<'lectura'>) {
  return (
    <Tarjeta>
      <div className="contenido-html leading-relaxed" dangerouslySetInnerHTML={{ __html: v.html }} />
      <BotonCompletar actividadId={v.id} completada={v.completada} texto="Marcar como leído" textoHecho="Leído" alCompletar={recargar} />
    </Tarjeta>
  );
}

export function Audio({ v, recargar }: Props<'audio'>) {
  if (!v.enlace) {
    return (
      <Tarjeta>
        <p className="text-center font-semibold">Disponible pronto</p>
      </Tarjeta>
    );
  }
  return (
    <Tarjeta>
      {v.reproductor ? (
        <audio controls preload="none" src={v.enlace} className="w-full">
          Tu navegador no puede reproducir este audio.
        </audio>
      ) : (
        <a href={v.enlace} target="_blank" rel="noopener noreferrer" className={`${enlaceExterno} w-full`}>
          Escuchar ▶
        </a>
      )}
      <BotonCompletar
        actividadId={v.id}
        completada={v.completada}
        texto="Marcar como escuchado"
        textoHecho="Escuchado"
        alCompletar={recargar}
      />
    </Tarjeta>
  );
}

export function Enlace({ v }: Props<'enlace'>) {
  return (
    <>
      <Tarjeta>
        {v.enlace ? (
          <a
            href={v.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className={`${enlaceExterno} w-full`}
            onClick={() => registrarEvento({ tipo: 'abrir_enlace', actividadId: v.id })}
          >
            Abrir el grupo ▶
          </a>
        ) : (
          <p className="text-center font-semibold">Tu promotor compartirá el enlace pronto.</p>
        )}
      </Tarjeta>
      <div className="mt-4">
        <Aviso tono="info">{v.derivacion}</Aviso>
      </div>
    </>
  );
}

export function Evaluacion({ v, recargar }: Props<'evaluacion'>) {
  if (!v.enlace) {
    return (
      <Tarjeta>
        <p className="text-center font-semibold">El enlace se activará en la fecha de la evaluación.</p>
      </Tarjeta>
    );
  }
  return (
    <Tarjeta>
      <p>
        Cuando el formulario te lo pida, escribe tu código: <strong className="font-mono text-lg">{v.codigo}</strong>
      </p>
      <a
        href={v.enlace}
        target="_blank"
        rel="noopener noreferrer"
        className={`${enlaceExterno} mt-4 w-full`}
        onClick={() => registrarEvento({ tipo: 'abrir_evaluacion', actividadId: v.id })}
      >
        Abrir cuestionario ▶
      </a>
      <BotonCompletar actividadId={v.id} completada={v.completada} texto="Ya lo respondí" textoHecho="Respondido" alCompletar={recargar} />
    </Tarjeta>
  );
}

export function Encuentro({ v, recargar }: Props<'encuentro'>) {
  const { mostrarXp } = useMarco();
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Tarjeta>
      {v.enlace ? (
        <a href={v.enlace} target="_blank" rel="noopener noreferrer" className={`${enlaceExterno} w-full`}>
          Entrar al encuentro ▶
        </a>
      ) : (
        <p className="text-center">Tu promotor compartirá el enlace del encuentro.</p>
      )}

      {v.completada ? (
        <p className="mt-5 rounded-xl bg-green-50 p-3 text-center font-bold text-verde" role="status">
          ✅ Asistencia registrada
        </p>
      ) : (
        <form
          className="mt-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setOcupado(true);
            setError(null);
            try {
              const r = await llamar<{ xpOtorgado: number }>(`/api/actividades/${v.id}/asistencia`, {
                metodo: 'POST',
                cuerpo: { codigo },
              });
              mostrarXp(r.xpOtorgado);
              recargar();
            } catch (err) {
              setError(errorTexto(err));
            } finally {
              setOcupado(false);
            }
          }}
        >
          <label htmlFor="codigo-asistencia" className="block font-bold">
            Código de asistencia
          </label>
          <p className="text-sm text-tinta/70">Te lo da tu promotor durante el encuentro.</p>
          <input
            id="codigo-asistencia"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            className="mt-2 min-h-11 w-full rounded-xl border-2 border-tinta/20 px-3 font-mono text-lg uppercase focus:border-cian"
          />
          {error && (
            <div className="mt-3">
              <Aviso tono="rojo">{error}</Aviso>
            </div>
          )}
          <Boton type="submit" variante="amarillo" className="mt-3 w-full" disabled={!codigo.trim() || ocupado}>
            {ocupado ? 'Verificando…' : 'Registrar asistencia'}
          </Boton>
        </form>
      )}
    </Tarjeta>
  );
}

export function Mision({ v, recargar }: Props<'mision'>) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(v.valores ?? {}).map(([k, x]) => [k, String(x)])),
  );
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = v.estado === 'nueva' || v.estado === 'devuelta';

  return (
    <Tarjeta>
      <p>{v.instrucciones}</p>

      {v.estado === 'pendiente' && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 font-semibold" role="status">
          ⏳ Enviada. Tu promotor la revisará pronto.
        </p>
      )}
      {v.estado === 'devuelta' && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3" role="status">
          ↩️ Tu promotor te pide revisar: «{v.comentario}»
        </p>
      )}
      {v.estado === 'aprobada' && (
        <p className="mt-4 rounded-xl bg-green-50 p-3 font-bold text-verde" role="status">
          ✅ Misión validada · +{v.xp} XP
        </p>
      )}

      {editable && (
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setOcupado(true);
            setError(null);
            try {
              await llamar('/api/evidencias', { metodo: 'POST', cuerpo: { misionId: v.id, campos: valores } });
              recargar();
            } catch (err) {
              setError(errorTexto(err));
              setOcupado(false);
            }
          }}
        >
          {v.campos.map((c) => {
            const id = `campo-${c.id}`;
            const comun = {
              id,
              name: c.id,
              value: valores[c.id] ?? '',
              onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                setValores((x) => ({ ...x, [c.id]: e.target.value })),
              className: 'mt-1 min-h-11 w-full rounded-xl border-2 border-tinta/20 px-3 py-2 focus:border-cian',
            };
            return (
              <div key={c.id}>
                <label htmlFor={id} className="block font-semibold">
                  {c.etiqueta}
                </label>
                {c.tipo === 'select' ? (
                  <select {...comun} required>
                    <option value="">Elige una opción</option>
                    {c.opciones!.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : c.tipo === 'numero' ? (
                  <input {...comun} type="number" inputMode="numeric" min={0} step={1} required />
                ) : c.tipo === 'texto' ? (
                  <input {...comun} type="text" maxLength={800} />
                ) : (
                  <textarea {...comun} rows={3} maxLength={800} />
                )}
              </div>
            );
          })}
          {error && <Aviso tono="rojo">{error}</Aviso>}
          <Boton type="submit" variante="amarillo" disabled={ocupado}>
            {ocupado ? 'Enviando…' : v.estado === 'devuelta' ? 'Reenviar' : 'Enviar'}
          </Boton>
        </form>
      )}
    </Tarjeta>
  );
}
