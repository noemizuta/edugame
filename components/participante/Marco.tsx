'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Pantalla } from '@/components/Sesion';
import type { RespuestaSesion } from '@/lib/servicios/sesion';
import { rutaPagina, sinPrefijo, vistaPrevia } from '@/lib/vista-previa-cliente';

interface ValorMarco {
  sesion: RespuestaSesion;
  experimental: boolean;
  /** Muestra el aviso «+N XP» (solo experimental, y solo si N > 0). */
  mostrarXp: (n: number) => void;
}

const Contexto = createContext<ValorMarco | null>(null);

export function useMarco(): ValorMarco {
  const v = useContext(Contexto);
  if (!v) throw new Error('useMarco fuera de <MarcoParticipante>');
  return v;
}

/** Pantallas del participante (con aula y avatar): navegación inferior fija y aviso de XP. */
export function MarcoParticipante({ children }: { children: React.ReactNode }) {
  const vp = vistaPrevia();
  if (vp) {
    // Vista previa (PA6): solo para el personal que la abre; perfil ficticio, sin guardar nada.
    return (
      <Pantalla pasos={['/admin', '/seguimiento']}>
        {(real) => (
          <>
            <AvisoVistaPrevia brazo={vp.brazo} dia={vp.dia} volver={real.rol === 'admin' ? '/admin#vista-previa' : '/seguimiento'} />
            <Interior sesion={sesionFicticia(vp.brazo)}>{children}</Interior>
          </>
        )}
      </Pantalla>
    );
  }
  return (
    <Pantalla pasos={['/inicio']}>
      {(sesion) => <Interior sesion={sesion}>{children}</Interior>}
    </Pantalla>
  );
}

function sesionFicticia(brazo: 'experimental' | 'control'): RespuestaSesion {
  return {
    rol: 'estudiante',
    siguientePaso: '/inicio',
    perfil: {
      rol: 'estudiante',
      codigo: 'G-VISTA',
      avatar: '🕵️',
      brazo,
      equipo: brazo === 'experimental' ? 'E1' : null,
      consentimiento: true,
      aula: { id: 'vista-previa', nombre: 'Aula de vista previa', brazo },
    },
  };
}

function AvisoVistaPrevia({ brazo, dia, volver }: { brazo: string; dia: number; volver: string }) {
  return (
    <div role="status" className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-rosa px-4 py-2 text-sm font-semibold text-white">
      <span>
        Vista previa · {brazo === 'experimental' ? 'Experimental' : 'Control'} · {dia < 1 ? 'Antes del inicio' : `Día ${dia}`} · no se guarda nada
      </span>
      <Link href={volver} className="underline">
        Salir de la vista previa
      </Link>
    </div>
  );
}

function Interior({ sesion, children }: { sesion: RespuestaSesion; children: React.ReactNode }) {
  const experimental = sesion.perfil.brazo === 'experimental';
  const [xp, setXp] = useState<number | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrarXp = useCallback(
    (n: number) => {
      if (!experimental || n <= 0) return;
      setXp(n);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setXp(null), 2800);
    },
    [experimental],
  );

  return (
    <Contexto.Provider value={{ sesion, experimental, mostrarXp }}>
      <div className="pb-[calc(5rem+env(safe-area-inset-bottom))]">{children}</div>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
        {xp !== null && (
          <p className="animate-[aparecer_.25s_ease-out] rounded-full bg-amarillo px-5 py-2 text-lg font-extrabold text-tinta shadow-xl">
            +{xp} XP
          </p>
        )}
      </div>
      <NavInferior experimental={experimental} />
    </Contexto.Provider>
  );
}

function NavInferior({ experimental }: { experimental: boolean }) {
  const ruta = sinPrefijo(usePathname());
  const items = [
    { href: rutaPagina('/inicio'), icono: '🏠', texto: 'Inicio', activo: ruta === '/inicio' || ruta.startsWith('/modulo') || ruta.startsWith('/actividad') },
    ...(experimental ? [{ href: rutaPagina('/ranking'), icono: '🏆', texto: 'Ranking', activo: ruta === '/ranking' }] : []),
    { href: rutaPagina('/perfil'), icono: '👤', texto: 'Perfil', activo: ruta === '/perfil' },
  ];
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-fondo-2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-xl">
        {items.map((i) => (
          <li key={i.href} className="flex-1">
            <Link
              href={i.href}
              aria-current={i.activo ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                i.activo ? 'text-amarillo' : 'text-white/75'
              }`}
            >
              <span aria-hidden="true" className="text-xl">
                {i.icono}
              </span>
              {i.texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AvisoDerivacion({ texto }: { texto: string }) {
  return (
    <aside className="mt-8 rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">
      <p>
        <span aria-hidden="true">ℹ️ </span>
        {texto}
      </p>
    </aside>
  );
}

export function Volver({ href, texto }: { href: string; texto: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-cian">
      <span aria-hidden="true">←</span> {texto}
    </Link>
  );
}
