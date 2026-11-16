import { configJuego } from '@/lib/contenido';
import { Consentimiento } from './Consentimiento';

// P02 Consentimiento
export default function PaginaConsentimiento() {
  const { consentimiento } = configJuego();
  return <Consentimiento {...consentimiento} />;
}
