import { configJuego } from '@/lib/contenido';
import { Perfil } from './Perfil';

// P08 Perfil
export default function PaginaPerfil() {
  return <Perfil avatares={configJuego().avatares} />;
}
