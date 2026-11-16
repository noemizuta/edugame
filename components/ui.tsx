/** Piezas de interfaz compartidas (sin librerías de componentes). */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4" aria-busy="true">
      <p className="text-white/80" role="status">
        {texto}
      </p>
    </main>
  );
}

export function Contenedor({ children, className = '' }: { children: ReactNode; className?: string }) {
  // Ancho máximo por defecto max-w-xl, salvo que `className` traiga otro.
  const ancho = /(^|\s)max-w-/.test(className) ? '' : 'max-w-xl';
  return (
    <main className={`mx-auto w-full ${ancho} px-4 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))] ${className}`}>{children}</main>
  );
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white p-5 text-tinta shadow-lg ${className}`}>{children}</section>;
}

type Variante = 'rosa' | 'amarillo' | 'cian' | 'claro';
const VARIANTES: Record<Variante, string> = {
  rosa: 'bg-rosa text-white hover:brightness-110',
  amarillo: 'bg-amarillo text-tinta hover:brightness-105',
  cian: 'bg-cian text-tinta hover:brightness-105',
  claro: 'bg-white/10 text-white hover:bg-white/20 border border-white/30',
};

export function Boton({
  variante = 'amarillo',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-11 rounded-full px-6 py-3 font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
    />
  );
}

export function Aviso({ tono = 'ambar', children }: { tono?: 'ambar' | 'rojo' | 'verde' | 'info'; children: ReactNode }) {
  const estilos = {
    ambar: 'border-amarillo bg-amber-50 text-tinta',
    rojo: 'border-rojo bg-red-50 text-tinta',
    verde: 'border-verde bg-green-50 text-tinta',
    info: 'border-cian bg-cyan-50 text-tinta',
  }[tono];
  return (
    <div role={tono === 'rojo' ? 'alert' : 'status'} className={`rounded-xl border-l-4 p-3 text-sm ${estilos}`}>
      {children}
    </div>
  );
}
