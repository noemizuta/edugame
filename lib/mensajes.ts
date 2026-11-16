/** Mensajes para los códigos de error de la API (texto de interfaz en español del Perú). */
const MENSAJES: Record<string, string> = {
  dominio_no_permitido: 'Usa tu cuenta institucional.',
  retirado: 'Tu participación en el estudio terminó. Gracias por tu tiempo.',
  proveedor_no_permitido: 'Ingresa con tu cuenta de Google.',
  codigo_incorrecto: 'No encontramos un aula con ese código. Revísalo con tu promotor.',
  demasiados_intentos: 'Demasiados intentos, espera unos minutos.',
  aula_completa: 'Esta aula está completa. Consulta con tu promotor.',
  aula_inactiva: 'Esta aula no está activa. Consulta con tu promotor.',
  avatar_invalido: 'Elige uno de los avatares.',
  version_invalida: 'El texto del consentimiento cambió. Recarga la página y léelo de nuevo.',
  propio_rol: 'No puedes cambiar tu propio rol.',
  ultimo_admin: 'Debe quedar al menos un administrador.',
  usuario_no_encontrado: 'No encontramos a ese usuario.',
  aula_no_encontrada: 'Una de las aulas elegidas no existe.',
  busqueda_invalida: 'Escribe un correo completo o un código G-XXXXX.',
  sin_conexion: 'No hay conexión. Revisa tu internet e inténtalo de nuevo.',
  codigo_asistencia_incorrecto: 'Código incorrecto. Revisa con tu promotor.',
  sin_codigo: 'Tu promotor aún no define el código de asistencia de este encuentro.',
  no_disponible: 'Esta actividad todavía no está disponible.',
  campos_invalidos: 'Revisa los campos del formulario: completa las opciones y los números.',
  ya_enviada: 'Ya enviaste esta misión. Tu promotor la revisará pronto.',
  ya_aprobada: 'Esta misión ya fue validada.',
  actividad_cerrada: 'Esta actividad todavía no se abre.',
  modulo_cerrado: 'Este módulo todavía no se abre.',
  solo_experimental: 'Esta sección no está disponible para tu aula.',
  orden_invalido: 'Responde los casos en orden. Recarga la página para continuar.',
  ya_completada: 'Ya completaste esta misión. Puedes repetirla para practicar.',
  practica_no_disponible: 'La práctica se habilita al terminar la misión.',
  rol_no_permitido: 'Tu cuenta no tiene acceso a esta sección.',
  paso_pendiente: 'Completa los pasos anteriores para continuar.',
  no_encontrado: 'No encontramos lo que buscas.',
};

export function mensajeError(codigo: string, datos: Record<string, unknown> = {}): string {
  if (codigo === 'ya_en_aula') {
    const aula = typeof datos.aula === 'string' && datos.aula ? `«${datos.aula}»` : 'otra aula';
    return `Ya perteneces al aula ${aula}. Si es un error, habla con tu promotor.`;
  }
  return MENSAJES[codigo] ?? 'Algo salió mal. Inténtalo de nuevo.';
}
