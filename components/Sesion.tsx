'use client';
/**
 * Estado de la sesión en el navegador: Firebase Auth (Google) + POST /api/sesion.
 * El navegador nunca lee Firestore: todo pasa por la API.
 */
import {
  GoogleAuthProvider,
  type User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ErrorCliente, llamar } from '@/lib/cliente-api';
import { clienteAuth } from '@/lib/firebase-client';
import type { Paso } from '@/lib/juego';
import type { RespuestaSesion } from '@/lib/servicios/sesion';
import { Cargando } from './ui';

export type EstadoSesion =
  | { fase: 'cargando' }
  | { fase: 'anonimo'; error?: string; detalle?: string }
  | { fase: 'lista'; sesion: RespuestaSesion };

interface ValorSesion {
  estado: EstadoSesion;
  entrar: () => Promise<void>;
  salir: () => Promise<void>;
  /** Actualiza la sesión con lo que devuelve una acción (p. ej. el siguiente paso). */
  actualizar: (cambio: (s: RespuestaSesion) => RespuestaSesion) => void;
}

const Contexto = createContext<ValorSesion | null>(null);

/** Errores de /api/sesion que obligan a cerrar la sesión de Google (p. ej. para cambiar de cuenta). */
const ERRORES_DE_CUENTA = new Set(['dominio_no_permitido', 'retirado', 'proveedor_no_permitido', 'sin_correo']);

export function ProveedorSesion({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>({ fase: 'cargando' });

  useEffect(() => {
    const auth = clienteAuth();
    return onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        setEstado((e) => (e.fase === 'anonimo' ? e : { fase: 'anonimo' }));
        return;
      }
      setEstado({ fase: 'cargando' });
      try {
        const sesion = await llamar<RespuestaSesion & { ok: true }>('/api/sesion', { metodo: 'POST' });
        setEstado({ fase: 'lista', sesion: { rol: sesion.rol, siguientePaso: sesion.siguientePaso, perfil: sesion.perfil } });
      } catch (e) {
        const codigo = e instanceof ErrorCliente ? e.codigo : 'error_interno';
        if (ERRORES_DE_CUENTA.has(codigo)) await signOut(auth).catch(() => {});
        // `detalle` (temporal): código y mensaje técnico del servidor, para diagnosticar el despliegue.
        const detalle = e instanceof ErrorCliente && typeof e.datos.detalle === 'string' ? e.datos.detalle : undefined;
        setEstado({ fase: 'anonimo', error: codigo, detalle });
      }
    });
  }, []);

  const entrar = useCallback(async () => {
    const auth = clienteAuth();
    const proveedor = new GoogleAuthProvider();
    proveedor.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, proveedor);
    } catch (e) {
      const codigo = (e as { code?: string }).code ?? '';
      if (codigo === 'auth/popup-blocked' || codigo === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, proveedor);
        return;
      }
      if (codigo === 'auth/popup-closed-by-user' || codigo === 'auth/cancelled-popup-request') return;
      setEstado({ fase: 'anonimo', error: codigo === 'auth/network-request-failed' ? 'sin_conexion' : 'ingreso_fallido' });
    }
  }, []);

  const salir = useCallback(async () => {
    await signOut(clienteAuth());
    setEstado({ fase: 'anonimo' });
  }, []);

  const actualizar = useCallback((cambio: (s: RespuestaSesion) => RespuestaSesion) => {
    setEstado((e) => (e.fase === 'lista' ? { fase: 'lista', sesion: cambio(e.sesion) } : e));
  }, []);

  const valor = useMemo(() => ({ estado, entrar, salir, actualizar }), [estado, entrar, salir, actualizar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ValorSesion {
  const v = useContext(Contexto);
  if (!v) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>');
  return v;
}

/**
 * Protege una pantalla: sin sesión vuelve a `/`; si al usuario le corresponde
 * otra pantalla (sección 5.1), lo lleva allí.
 */
export function Pantalla({
  pasos,
  children,
}: {
  /** Valores de `siguientePaso` con los que se puede ver esta pantalla. */
  pasos: readonly Paso[];
  children: (sesion: RespuestaSesion) => React.ReactNode;
}) {
  const { estado } = useSesion();
  const router = useRouter();
  const ruta = usePathname();
  const permitido = estado.fase === 'lista' && pasos.includes(estado.sesion.siguientePaso);

  useEffect(() => {
    if (estado.fase === 'anonimo') router.replace('/');
    else if (estado.fase === 'lista' && !permitido && ruta !== estado.sesion.siguientePaso) {
      router.replace(estado.sesion.siguientePaso);
    }
  }, [estado, permitido, router, ruta]);

  if (estado.fase !== 'lista' || !permitido) return <Cargando />;
  return <>{children(estado.sesion)}</>;
}
