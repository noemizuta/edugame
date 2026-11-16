'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { Cargando } from '@/components/ui';
import { activarVistaPrevia } from '@/lib/vista-previa-cliente';

/** PA6 · Vista previa: activa el modo (brazo y día de la URL) para las pantallas del participante. */
export default function LayoutVistaPrevia({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Cargando />}>
      <Modo>{children}</Modo>
    </Suspense>
  );
}

function Modo({ children }: { children: React.ReactNode }) {
  const p = useSearchParams();
  const brazo = p.get('brazo') === 'control' ? 'control' : 'experimental';
  const dia = Number.parseInt(p.get('dia') ?? '1', 10);
  // Se activa al renderizar, antes de que las pantallas pidan datos.
  activarVistaPrevia({ brazo, dia: Number.isFinite(dia) ? dia : 1 });
  // Se apaga solo al salir de /vista-previa. En desarrollo, React desmonta y vuelve a montar las
  // pantallas (modo estricto) sin cambiar la URL: ahí no debe apagarse, o la API iría sin el espejo.
  useEffect(
    () => () => {
      setTimeout(() => {
        if (!window.location.pathname.startsWith('/vista-previa')) activarVistaPrevia(null);
      });
    },
    [],
  );
  return <>{children}</>;
}
