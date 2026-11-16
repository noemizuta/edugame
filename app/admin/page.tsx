'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PanelRoles } from '@/components/admin/Roles';
import { Aulas, Configuracion, Exportar, Participantes, VistaPreviaLanzador } from '@/components/admin/Secciones';
import { Pantalla, useSesion } from '@/components/Sesion';
import { Contenedor } from '@/components/ui';

const PESTANAS = [
  { id: 'aulas', texto: 'Aulas' },
  { id: 'roles', texto: 'Usuarios y roles' },
  { id: 'participantes', texto: 'Participantes' },
  { id: 'configuracion', texto: 'Configuración' },
  { id: 'vista-previa', texto: 'Vista previa' },
  { id: 'exportar', texto: 'Exportar' },
] as const;
type Pestana = (typeof PESTANAS)[number]['id'];

// Panel del administrador (PA1–PA7 y roles, decisión 6).
export default function Admin() {
  return <Pantalla pasos={['/admin']}>{() => <PanelAdmin />}</Pantalla>;
}

function PanelAdmin() {
  const { salir } = useSesion();
  const [actual, setActual] = useState<Pestana>('aulas');

  // La pestaña va en la URL (#aulas, #roles…) para poder volver a ella.
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (PESTANAS.some((p) => p.id === h)) setActual(h as Pestana);
  }, []);
  const elegir = (id: Pestana) => {
    setActual(id);
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <Contenedor className="max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Administración</h1>
        <div className="flex items-center gap-4">
          <Link href="/seguimiento" className="min-h-11 content-center text-sm text-cian underline">
            Seguimiento (vista del investigador)
          </Link>
          <button type="button" className="min-h-11 text-sm text-cian underline" onClick={() => void salir()}>
            Cerrar sesión
          </button>
        </div>
      </div>
      <div role="tablist" aria-label="Secciones del administrador" className="mt-4 flex gap-1 overflow-x-auto">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            role="tab"
            type="button"
            id={`tab-${p.id}`}
            aria-selected={actual === p.id}
            aria-controls={`panel-${p.id}`}
            onClick={() => elegir(p.id)}
            className={`min-h-11 shrink-0 rounded-t-xl px-4 font-semibold ${actual === p.id ? 'bg-white text-tinta' : 'bg-white/10 text-white'}`}
          >
            {p.texto}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${actual}`} aria-labelledby={`tab-${actual}`}>
        {actual === 'aulas' && <Aulas />}
        {actual === 'roles' && <PanelRoles />}
        {actual === 'participantes' && <Participantes />}
        {actual === 'configuracion' && <Configuracion />}
        {actual === 'vista-previa' && <VistaPreviaLanzador />}
        {actual === 'exportar' && <Exportar />}
      </div>
    </Contenedor>
  );
}
