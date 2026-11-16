'use client';
import Link from 'next/link';
import { AvisoDerivacion, MarcoParticipante, useMarco } from '@/components/participante/Marco';
import { Aviso, Cargando, Contenedor } from '@/components/ui';
import { mensajeError } from '@/lib/mensajes';
import { useDatos } from '@/lib/useDatos';
import { rutaPagina } from '@/lib/vista-previa-cliente';

import type { DatosYo } from '@/lib/tipos-cliente';
type ModuloInicio = DatosYo['modulos'][number];

const ORDEN_GRUPOS = ['Aprender', 'Jugar y actuar', 'Actividades', 'Conectar', 'Mi progreso'];

// P05 Inicio
export default function PaginaInicio() {
  return (
    <MarcoParticipante>
      <Inicio />
    </MarcoParticipante>
  );
}

function Inicio() {
  const { datos, error } = useDatos<DatosYo>('/api/yo');
  if (error) {
    return (
      <Contenedor>
        <Aviso tono="rojo">{mensajeError(error.codigo, error.datos)}</Aviso>
      </Contenedor>
    );
  }
  if (!datos) return <Cargando />;
  return datos.juego ? <InicioExperimental d={datos} /> : <InicioControl d={datos} />;
}

function InicioExperimental({ d }: { d: DatosYo }) {
  const j = d.juego!;
  const pct = Math.round(j.nivel.progreso * 100);
  return (
    <Contenedor>
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">Guardianes del Antibiótico</h1>
        <Link
          href={rutaPagina('/perfil')}
          className="shrink-0 rounded-full bg-amarillo px-3 py-1.5 text-sm font-bold text-tinta"
          aria-label={`${j.xp} XP, rango ${j.nivel.nombre}. Ir a mi perfil`}
        >
          {j.xp} XP · {j.nivel.nombre}
        </Link>
      </header>
      <p className="mt-1 text-sm text-cian">{d.fase}</p>

      <section className="mt-4 rounded-2xl bg-gradient-to-br from-fondo-2 to-[#1d4aa8] p-4 shadow-lg" aria-label="Tu héroe">
        <div className="flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full border-4 border-cian bg-fondo text-4xl" aria-hidden="true">
            {d.perfil.avatar}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold text-amarillo">{j.nivel.nombre}</p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label="Progreso al siguiente rango"
              className="mt-1 h-3 overflow-hidden rounded-full bg-white/15"
            >
              <div className="h-full rounded-full bg-gradient-to-r from-cian to-amarillo" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-white/85">
              {j.xp} XP{j.nivel.siguiente ? ` · faltan ${j.nivel.faltan} para ${j.nivel.siguiente.nombre}` : ' · rango máximo'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          <span>
            <span aria-hidden="true">🔥</span> Racha: {j.racha} {j.racha === 1 ? 'día' : 'días'}
          </span>
          <span>
            <span aria-hidden="true">👥</span> Equipo {j.equipo}
          </span>
        </div>
      </section>

      <TarjetaSiguiente d={d} />
      <Modulos modulos={d.modulos} />
      <AvisoDerivacion texto={d.derivacion} />
    </Contenedor>
  );
}

function InicioControl({ d }: { d: DatosYo }) {
  return (
    <Contenedor>
      <h1 className="text-xl font-extrabold">Aprende sobre antibióticos</h1>
      <p className="mt-1">Hola, {d.perfil.codigo}</p>
      <p className="text-sm text-white/80">Contenidos sobre uso responsable de antibióticos</p>
      <p className="mt-1 text-sm text-cian">{d.fase}</p>
      <TarjetaSiguiente d={d} />
      <Modulos modulos={d.modulos} />
      <AvisoDerivacion texto={d.derivacion} />
    </Contenedor>
  );
}

function TarjetaSiguiente({ d }: { d: DatosYo }) {
  const { experimental } = useMarco();
  const s = d.semanal;
  const contenido = (
    <>
      <div className="min-w-0">
        <p className="text-sm font-bold uppercase tracking-wide">{d.tarjetaSemana}</p>
        <p className="mt-1 text-lg font-extrabold leading-snug">{s.texto}</p>
      </div>
      {s.enlace && (
        <span className="shrink-0 rounded-full bg-tinta px-4 py-2 text-sm font-bold text-amarillo">
          {experimental ? 'Ir ▶' : 'Ver ▶'}
        </span>
      )}
    </>
  );
  const clases = 'mt-4 flex items-center justify-between gap-3 rounded-2xl bg-amarillo p-4 text-tinta shadow-lg';
  return s.enlace ? (
    <Link href={rutaPagina(s.enlace)} className={clases}>
      {contenido}
    </Link>
  ) : (
    <section className={clases}>{contenido}</section>
  );
}

function Modulos({ modulos }: { modulos: ModuloInicio[] }) {
  const grupos = ORDEN_GRUPOS.map((g) => ({ g, ms: modulos.filter((m) => m.grupo === g) })).filter((x) => x.ms.length);
  return (
    <>
      {grupos.map(({ g, ms }) => (
        <section key={g} className="mt-6" aria-labelledby={`grupo-${g}`}>
          <h2 id={`grupo-${g}`} className="mb-2 text-sm font-bold uppercase tracking-wide text-white/80">
            {g}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ms.map((m) => (
              <li key={m.id}>
                <Pildora m={m} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function Pildora({ m }: { m: ModuloInicio }) {
  const cerrado = m.estado.tipo === 'cerrado';
  const color = m.color === 'amarillo' ? 'bg-amarillo' : 'bg-cian';
  const interior = (
    <>
      <span className="text-2xl" aria-hidden="true">
        {m.icono}
      </span>
      <span className="mt-1 block font-extrabold leading-tight">{m.titulo}</span>
      <span className="mt-1 block text-xs font-semibold">
        {cerrado && <span aria-hidden="true">🔒 </span>}
        {m.estado.texto}
      </span>
      <span
        aria-hidden="true"
        className="absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full bg-tinta text-xs text-white"
      >
        {cerrado ? '🔒' : '▶'}
      </span>
    </>
  );
  const clases = `relative block min-h-28 rounded-2xl p-3 pr-10 text-tinta shadow ${color}`;
  if (cerrado) {
    return (
      <div className={`${clases} opacity-55`} aria-label={`${m.titulo}: ${m.estado.texto}`}>
        {interior}
      </div>
    );
  }
  return (
    <Link href={rutaPagina(`/modulo/${m.id}`)} className={`${clases} transition hover:brightness-105`}>
      {interior}
    </Link>
  );
}
