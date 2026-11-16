'use client';
import { PanelAulas } from '@/components/panel/PanelAulas';
import { Pantalla } from '@/components/Sesion';

// Investigador: ve el progreso de todas las aulas y descarga los CSV, sin editar nada (decisión 6).
export default function Seguimiento() {
  return (
    <Pantalla pasos={['/seguimiento', '/admin']}>{() => <PanelAulas titulo="Seguimiento del estudio" soloLectura />}</Pantalla>
  );
}
