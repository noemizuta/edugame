'use client';
import Image from 'next/image';
import QRCode from 'qrcode';
import { use, useEffect, useState } from 'react';
import { Pantalla } from '@/components/Sesion';
import { Aviso, Boton, Cargando } from '@/components/ui';
import { mensajeError } from '@/lib/mensajes';
import type { aulasDelPanel } from '@/lib/servicios/panel';
import { useDatos } from '@/lib/useDatos';

type AulaPanel = Awaited<ReturnType<typeof aulasDelPanel>>[number];

// Afiche A4 del aula: QR con /unirse?codigo=…, el código grande y 3 pasos (PP1).
export default function PaginaAfiche({ params }: { params: Promise<{ aulaId: string }> }) {
  const { aulaId } = use(params);
  return <Pantalla pasos={['/panel', '/admin', '/seguimiento']}>{() => <Afiche aulaId={aulaId} />}</Pantalla>;
}

function Afiche({ aulaId }: { aulaId: string }) {
  const { datos, error } = useDatos<{ aulas: AulaPanel[] }>('/api/panel/aulas');
  const aula = datos?.aulas.find((a) => a.id === aulaId);
  const [svg, setSvg] = useState<string | null>(null);
  const base = (process.env.NEXT_PUBLIC_URL_SITIO || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const url = aula ? `${base}/unirse?codigo=${aula.codigoUnion}` : '';

  useEffect(() => {
    if (!url) return;
    void QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#10223f', light: '#ffffff' } }).then(setSvg);
  }, [url]);

  if (error) return <Aviso tono="rojo">{mensajeError(error.codigo, error.datos)}</Aviso>;
  if (!datos) return <Cargando />;
  if (!aula) return <Aviso tono="rojo">No tienes acceso a esta aula.</Aviso>;

  return (
    <div className="min-h-dvh bg-white text-tinta print:min-h-0">
      <style>{`@page { size: A4; margin: 14mm; } @media print { body { background: #fff !important; } }`}</style>
      <div className="mx-auto flex max-w-[180mm] justify-end gap-2 p-4 print:hidden">
        <Boton variante="rosa" onClick={() => window.print()}>
          Imprimir
        </Boton>
      </div>
      <article className="mx-auto flex max-w-[180mm] flex-col items-center px-6 pb-10 text-center">
        <p className="text-sm tracking-wide">Universidad Nacional del Callao</p>
        <div className="mt-2 flex items-center gap-3">
          <Image src="/img/logo-192.png" alt="" width={56} height={56} />
          <h1 className="text-4xl font-extrabold">EduGame RAM</h1>
        </div>
        <p className="mt-2 text-xl font-semibold">Únete a tu aula: {aula.nombre}</p>

        {svg ? (
          <div
            className="mt-6 w-[95mm] max-w-full [&>svg]:h-auto [&>svg]:w-full"
            role="img"
            aria-label={`Código QR que abre ${url}`}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="mt-6 h-[95mm] w-[95mm]" />
        )}

        <p className="mt-6 text-lg">Código del aula</p>
        <p className="font-mono text-6xl font-extrabold tracking-[0.25em]">{aula.codigoUnion}</p>

        <ol className="mt-8 w-full max-w-[150mm] list-none space-y-3 text-left text-lg">
          <li className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tinta font-bold text-white">1</span>
            <span>
              Abre el enlace en <strong>Chrome o Safari</strong> (escanea el QR o entra a <span className="break-all">{base}/unirse</span>).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tinta font-bold text-white">2</span>
            <span>
              <strong>Entra con Google.</strong>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tinta font-bold text-white">3</span>
            <span>
              <strong>Escribe el código</strong> {aula.codigoUnion}.
            </span>
          </li>
        </ol>
      </article>
    </div>
  );
}
