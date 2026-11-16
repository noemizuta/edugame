'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSesion } from '@/components/Sesion';
import { Aviso, Boton } from '@/components/ui';
import { mensajeError } from '@/lib/mensajes';
import { type InfoNavegador, analizarNavegador, enlaceIntentChrome } from '@/lib/navegador';
import { leerCodigoPendiente } from '@/lib/pendiente';

export function Ingreso() {
  const { estado, entrar } = useSesion();
  const router = useRouter();
  const [nav, setNav] = useState<InfoNavegador | null>(null);
  const [entrando, setEntrando] = useState(false);

  useEffect(() => setNav(analizarNavegador(navigator.userAgent)), []);

  // Con sesión: a la pantalla que corresponde (con el código del QR, si lo hay).
  useEffect(() => {
    if (estado.fase !== 'lista') return;
    const paso = estado.sesion.siguientePaso;
    const pendiente = leerCodigoPendiente();
    router.replace(paso === '/unirse' && pendiente ? `/unirse?codigo=${encodeURIComponent(pendiente)}` : paso);
  }, [estado, router]);

  if (!nav) return <div className="h-24" />;
  if (nav.integrado) return <AvisoNavegadorIntegrado nav={nav} />;

  const ocupado = entrando || estado.fase === 'cargando' || estado.fase === 'lista';
  const error = estado.fase === 'anonimo' ? estado.error : undefined;

  return (
    <div className="mt-4 flex w-full flex-col gap-3">
      {error && <Aviso tono="rojo">{mensajeError(error)}</Aviso>}
      <Boton
        variante="rosa"
        className="w-full"
        disabled={ocupado}
        onClick={async () => {
          setEntrando(true);
          try {
            await entrar();
          } finally {
            setEntrando(false);
          }
        }}
      >
        {ocupado ? 'Ingresando…' : 'Entrar con Google'}
      </Boton>
    </div>
  );
}

function AvisoNavegadorIntegrado({ nav }: { nav: InfoNavegador }) {
  const [copiado, setCopiado] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="mt-4 w-full rounded-2xl bg-white p-5 text-left text-tinta" role="alert">
      <p className="text-lg font-bold">Para ingresar con Google, abre este enlace en Chrome o Safari</p>
      <p className="mt-2 text-sm">
        {nav.app && nav.app !== 'WebView' ? `Estás en el navegador de ${nav.app}, ` : 'Estás en un navegador integrado, '}
        donde Google no permite ingresar.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
        {nav.plataforma === 'ios' ? (
          <li>
            Toca <strong>···</strong> o el ícono de compartir → <strong>Abrir en Safari</strong>.
          </li>
        ) : (
          <li>
            Toca <strong>⋮</strong> → <strong>Abrir en el navegador</strong>.
          </li>
        )}
        <li>O copia el enlace y pégalo en Chrome o Safari.</li>
      </ol>
      <div className="mt-4 flex flex-col gap-2">
        {nav.plataforma === 'android' && url && (
          <a
            href={enlaceIntentChrome(url)}
            className="flex min-h-11 items-center justify-center rounded-full bg-rosa px-6 py-3 font-bold text-white"
          >
            Abrir en Chrome
          </a>
        )}
        <Boton
          variante="cian"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopiado(true);
            } catch {
              window.prompt('Copia este enlace:', url);
            }
          }}
        >
          {copiado ? 'Enlace copiado ✓' : 'Copiar enlace'}
        </Boton>
      </div>
    </div>
  );
}
