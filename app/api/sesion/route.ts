import { rutaToken } from '@/lib/api';
import { crearSesion } from '@/lib/servicios/sesion';

/** Crea o actualiza el usuario y devuelve `{ rol, siguientePaso, perfil }`. */
export const POST = rutaToken({}, async ({ token, ahora }) => ({ ...(await crearSesion(token, ahora)) }));
