'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Pantalla, useSesion } from '@/components/Sesion';
import { Aviso, Boton, Contenedor, Tarjeta } from '@/components/ui';
import { ErrorCliente, llamar } from '@/lib/cliente-api';
import type { Paso } from '@/lib/juego';
import { mensajeError } from '@/lib/mensajes';

export function Consentimiento({ version, texto, casilla }: { version: string; texto: string; casilla: string }) {
  const { actualizar, salir } = useSesion();
  const router = useRouter();
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continuar() {
    setEnviando(true);
    setError(null);
    try {
      const r = await llamar<{ siguientePaso: Paso }>('/api/consentimiento', { metodo: 'POST', cuerpo: { version } });
      actualizar((s) => ({ ...s, siguientePaso: r.siguientePaso, perfil: { ...s.perfil, consentimiento: true } }));
      router.replace(r.siguientePaso);
    } catch (e) {
      setError(mensajeError(e instanceof ErrorCliente ? e.codigo : ''));
      setEnviando(false);
    }
  }

  return (
    <Pantalla pasos={['/consentimiento']}>
      {() => (
        <Contenedor>
          <h1 className="mb-4 text-2xl font-extrabold">Consentimiento informado</h1>
          <Tarjeta>
            <p className="leading-relaxed">{texto}</p>
            <p className="mt-3 text-xs text-tinta/60">Versión {version}</p>
            <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
              <input
                type="checkbox"
                className="size-6 accent-rosa"
                checked={acepto}
                onChange={(e) => setAcepto(e.target.checked)}
              />
              {casilla}
            </label>
            {error && (
              <div className="mt-3">
                <Aviso tono="rojo">{error}</Aviso>
              </div>
            )}
            <Boton variante="rosa" className="mt-4 w-full" disabled={!acepto || enviando} onClick={continuar}>
              {enviando ? 'Guardando…' : 'Continuar'}
            </Boton>
          </Tarjeta>
          <p className="mt-5 text-center text-sm text-white/75">
            ¿Eres parte del equipo del estudio? No necesitas aceptar: pide al administrador que te asigne tu rol y vuelve
            a ingresar.
          </p>
          <div className="mt-3 text-center">
            <button type="button" className="min-h-11 text-sm text-cian underline" onClick={() => void salir()}>
              Cerrar sesión
            </button>
          </div>
        </Contenedor>
      )}
    </Pantalla>
  );
}
