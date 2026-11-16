'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Pantalla, useSesion } from '@/components/Sesion';
import { Aviso, Boton, Contenedor, Tarjeta } from '@/components/ui';
import { ErrorCliente, llamar } from '@/lib/cliente-api';
import type { Equipo, Paso } from '@/lib/juego';
import { mensajeError } from '@/lib/mensajes';
import { borrarCodigoPendiente, guardarCodigoPendiente, leerCodigoPendiente } from '@/lib/pendiente';
import type { PerfilSesion } from '@/lib/servicios/sesion';

const limpiar = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);

export function Unirse({ codigoInicial }: { codigoInicial: string }) {
  // Si llega por el QR sin sesión, se guarda el código para después de ingresar.
  useEffect(() => {
    if (codigoInicial) guardarCodigoPendiente(codigoInicial);
  }, [codigoInicial]);

  return <Pantalla pasos={['/unirse']}>{() => <Formulario codigoInicial={codigoInicial} />}</Pantalla>;
}

interface RespuestaUnion {
  aula: NonNullable<PerfilSesion['aula']>;
  equipo: Equipo | null;
  siguientePaso: Paso;
}

function Formulario({ codigoInicial }: { codigoInicial: string }) {
  const { actualizar, salir } = useSesion();
  const router = useRouter();
  const [codigo, setCodigo] = useState(() => codigoInicial || limpiar(leerCodigoPendiente() ?? ''));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await llamar<RespuestaUnion>('/api/aulas/unirse', { metodo: 'POST', cuerpo: { codigo } });
      borrarCodigoPendiente();
      actualizar((s) => ({
        ...s,
        siguientePaso: r.siguientePaso,
        perfil: { ...s.perfil, aula: r.aula, brazo: r.aula.brazo, equipo: r.equipo },
      }));
      router.replace(r.siguientePaso);
    } catch (err) {
      if (err instanceof ErrorCliente && err.codigo === 'ya_en_aula') borrarCodigoPendiente();
      setError(err instanceof ErrorCliente ? mensajeError(err.codigo, err.datos) : mensajeError(''));
      setEnviando(false);
    }
  }

  return (
    <Contenedor>
      <h1 className="mb-4 text-2xl font-extrabold">Únete a tu aula</h1>
      <Tarjeta>
        <form onSubmit={enviar} noValidate>
          <label htmlFor="codigo" className="block text-lg font-bold">
            Ingresa el código de tu aula
          </label>
          <p id="ayuda-codigo" className="mt-1 text-sm text-tinta/70">
            Te lo da tu promotor PRO-RAM.
          </p>
          <input
            id="codigo"
            name="codigo"
            value={codigo}
            onChange={(e) => setCodigo(limpiar(e.target.value))}
            aria-describedby="ayuda-codigo"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            placeholder="K7Q2PX"
            className="mt-3 w-full rounded-xl border-2 border-tinta/20 px-4 py-3 text-center font-mono text-3xl tracking-[0.3em] uppercase focus:border-cian"
          />
          {error && (
            <div className="mt-3">
              <Aviso tono="rojo">{error}</Aviso>
            </div>
          )}
          <Boton type="submit" variante="rosa" className="mt-4 w-full" disabled={codigo.length !== 6 || enviando}>
            {enviando ? 'Verificando…' : 'Unirme'}
          </Boton>
        </form>
      </Tarjeta>
      <p className="mt-5 text-center text-sm text-white/75">
        Si eres parte del equipo del estudio, pide al administrador que te asigne tu rol.
      </p>
      <div className="mt-3 text-center">
        <button type="button" className="min-h-11 text-sm text-cian underline" onClick={() => void salir()}>
          Cerrar sesión
        </button>
      </div>
    </Contenedor>
  );
}
