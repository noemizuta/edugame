import Image from 'next/image';
import { configJuego } from '@/lib/contenido';
import { Ingreso } from './Ingreso';

// P01 Bienvenida + «Entrar con Google»
export default function Bienvenida() {
  const { app } = configJuego();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <p className="text-sm tracking-wide text-cian">{app.institucion}</p>
      <h1 className="text-4xl font-extrabold">{app.nombre}</h1>
      <Image src="/img/logo-512.png" alt="Logo de EduGame RAM: escudo con una cápsula" width={160} height={160} priority />
      <p className="text-2xl font-bold text-amarillo">{app.titulo}</p>
      <p className="text-white/85">{app.lema}</p>
      <Ingreso />
    </main>
  );
}
