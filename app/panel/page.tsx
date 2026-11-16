'use client';
import { PanelAulas } from '@/components/panel/PanelAulas';
import { Pantalla } from '@/components/Sesion';

// Panel del promotor (PP1–PP5). El admin también entra (ve todas las aulas).
export default function Panel() {
  return (
    <Pantalla pasos={['/panel', '/admin']}>
      {(s) => <PanelAulas titulo={s.rol === 'admin' ? 'Aulas' : 'Panel del promotor'} />}
    </Pantalla>
  );
}
