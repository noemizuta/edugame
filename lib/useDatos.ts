'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorCliente, llamar } from './cliente-api';

/** Carga datos de la API (GET). `ruta` null = no cargar todavía. */
export function useDatos<T>(ruta: string | null) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<ErrorCliente | null>(null);
  const [cargando, setCargando] = useState(!!ruta);

  const cargar = useCallback(async () => {
    if (!ruta) return;
    setCargando(true);
    try {
      setDatos(await llamar<T>(ruta));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorCliente ? e : new ErrorCliente(0, 'error_interno'));
    } finally {
      setCargando(false);
    }
  }, [ruta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { datos, error, cargando, recargar: cargar, setDatos };
}

/** Registra un evento de navegación una sola vez por montaje (ver_modulo, ver_item…). */
export function useEventoUnaVez(cuerpo: Record<string, string> | null) {
  const enviado = useRef<string | null>(null);
  const clave = cuerpo ? JSON.stringify(cuerpo) : null;
  useEffect(() => {
    if (!clave || enviado.current === clave) return;
    enviado.current = clave;
    void llamar('/api/eventos', { metodo: 'POST', cuerpo: JSON.parse(clave) }).catch(() => {});
  }, [clave]);
}

export function registrarEvento(cuerpo: Record<string, string>) {
  void llamar('/api/eventos', { metodo: 'POST', cuerpo }).catch(() => {});
}
