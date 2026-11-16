import { configJuego } from '@/lib/contenido';
import { BienvenidaAula } from './BienvenidaAula';

// P04 Bienvenida al aula: avatar y, en el experimental, el equipo
export default function PaginaBienvenidaAula() {
  return <BienvenidaAula avatares={configJuego().avatares} />;
}
