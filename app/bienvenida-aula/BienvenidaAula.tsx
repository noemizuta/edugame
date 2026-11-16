'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Pantalla, useSesion } from '@/components/Sesion';
import { Aviso, Boton, Contenedor, Tarjeta } from '@/components/ui';
import { ErrorCliente, llamar } from '@/lib/cliente-api';
import type { Paso } from '@/lib/juego';
import { mensajeError } from '@/lib/mensajes';
import type { RespuestaSesion } from '@/lib/servicios/sesion';

export function BienvenidaAula({ avatares }: { avatares: string[] }) {
  return <Pantalla pasos={['/bienvenida-aula']}>{(s) => <Contenido sesion={s} avatares={avatares} />}</Pantalla>;
}

function Contenido({ sesion, avatares }: { sesion: RespuestaSesion; avatares: string[] }) {
  const { actualizar } = useSesion();
  const router = useRouter();
  const { perfil } = sesion;
  const [avatar, setAvatar] = useState<string | null>(perfil.avatar);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const experimental = perfil.brazo === 'experimental';

  async function entrar() {
    if (!avatar) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await llamar<{ avatar: string; siguientePaso: Paso }>('/api/perfil', { metodo: 'PATCH', cuerpo: { avatar } });
      actualizar((s) => ({ ...s, siguientePaso: r.siguientePaso, perfil: { ...s.perfil, avatar: r.avatar } }));
      router.replace(r.siguientePaso);
    } catch (e) {
      setError(mensajeError(e instanceof ErrorCliente ? e.codigo : ''));
      setEnviando(false);
    }
  }

  return (
    <Contenedor>
      <h1 className="mb-4 text-2xl font-extrabold">Te uniste a {perfil.aula?.nombre ?? 'tu aula'}</h1>
      <Tarjeta>
        <fieldset>
          <legend className="text-lg font-bold">Elige tu avatar</legend>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {avatares.map((a) => (
              <label
                key={a}
                className={`flex aspect-square cursor-pointer items-center justify-center rounded-2xl border-2 text-4xl transition has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-cian ${
                  avatar === a ? 'border-cian bg-cyan-50' : 'border-tinta/10 bg-tinta/5'
                }`}
              >
                <input
                  type="radio"
                  name="avatar"
                  value={a}
                  checked={avatar === a}
                  onChange={() => setAvatar(a)}
                  className="sr-only"
                />
                <span aria-hidden="true">{a}</span>
                <span className="sr-only">Avatar {a}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {experimental && perfil.equipo && (
          <p className="mt-5 rounded-xl bg-amarillo/20 p-3">
            Eres parte del equipo <strong>{perfil.equipo}</strong>. Juntos sumarán puntos en el ranking.
          </p>
        )}

        <p className="mt-4">
          Tu código de participante es <strong className="font-mono text-lg">{perfil.codigo}</strong>; lo usarás en los
          cuestionarios.
        </p>
        <p className="mt-2 text-sm text-tinta/70">Usa siempre la misma cuenta de Google para ingresar.</p>

        {error && (
          <div className="mt-3">
            <Aviso tono="rojo">{error}</Aviso>
          </div>
        )}
        <Boton variante="rosa" className="mt-5 w-full" disabled={!avatar || enviando} onClick={entrar}>
          {enviando ? 'Guardando…' : 'Entrar'}
        </Boton>
      </Tarjeta>
    </Contenedor>
  );
}
