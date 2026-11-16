# Decisiones y plan de construcción

Registro de decisiones tomadas con el equipo antes y durante la construcción del MVP. Complementa `docs/ESPECIFICACION.md` (fuente de verdad).

## Decisiones (2026-11-14)

1. **Textos con tono de juego visibles para el control.**
   - Se agrega un campo opcional `descripcionControl` en los módulos.
   - Si falta, el control **no ve** la descripción del módulo.
   - Los retos, las explicaciones y los casos se muestran tal cual, salvo que en la retroalimentación se quita el «¡…!» inicial, como dice la especificación.
   - La lista de frases con tono de juego que ve el control va en `docs/REVISION_CONTENIDO.md` (se genera en la fase 3) para que la revise el equipo de investigación.
2. **Ubicación.** El proyecto se construye **fuera de OneDrive**, para evitar bloqueos EPERM con `node_modules` y `.next`.
3. **Herramientas.** Microsoft OpenJDK 21 y Git se instalaron con winget. `firebase-tools` va como dependencia de desarrollo del proyecto.
4. **Reorganización del kit.**
   - `contenido/` se copia **sin cambios** a `content/`.
   - Los archivos de `firebase/` pasan a la raíz.
   - Los logos y la portada pasan a `public/img/`.
   - `referencia/`, `investigacion/`, el `.zip` y los `.md`/`.png` duplicados de la raíz se mueven a `kit/` (en `.gitignore`). No se borra nada.
5. **Insignia Explorador.** Se aplica la regla de `config-juego.json` («mision1 completada», con cualquier puntaje), aunque la intro de la Misión 1 dice «Con 8 pistas o más, completas la misión».

## Decisión 6 · Roles (2026-11-14)
Reemplaza lo que dice la especificación sobre la «investigadora», `INVESTIGADORA_EMAILS` y las invitaciones de personal (secciones 1, 5.3, 7.3, 11, 12 y 14, y el criterio 13 de la sección 18).

**Cuatro roles** (`usuarios.rol`): `admin`, `investigador`, `promotor` y `estudiante`.

| Rol | Qué hace |
|---|---|
| `estudiante` | **Rol por defecto** de toda cuenta nueva. Es el participante de la especificación: consentimiento, unirse al aula, actividades (experimental o control) |
| `promotor` | Igual que en la especificación (PP1–PP5), solo en sus aulas: semáforo, equipos, evidencias, encuentros, grupo del aula y CSV |
| `investigador` | **Solo observa.** Ve el progreso de todas las aulas (resumen, semáforo, tabla de participantes por código, evidencias) y descarga los CSV. No edita nada, no ve correos y **no resuelve actividades** |
| `admin` | Todo lo de la «investigadora» de la especificación (aulas, enlaces O1–O3 y servicio médico, buscar por correo, mover, retirar, vista previa, exportar, ver y operar cualquier aula como su promotor) **y además asigna roles** |

**Primer admin.** La **primera cuenta que ingresa** al sitio queda como `admin`. Se reserva con una transacción sobre `config/sistema` (`{ primerAdmin: uid, en }`), así que solo puede haber un «primero». Después, solo un admin asigna roles. *Riesgo:* quien entre primero tras el despliegue será admin; hay que ingresar apenas se despliegue y antes de compartir el enlace.

**Asignación de roles (solo usuarios registrados).**
- La persona ingresa primero con Google y queda como `estudiante`. Luego el admin la busca (por correo o código) y le cambia el rol a `investigador`, `promotor` (con sus aulas) o `admin`.
- Se usa el mismo mecanismo para los promotores, así que **no hay invitaciones por correo** (`invitacionesStaff` desaparece).
- Si la persona ya se había unido a un aula como estudiante, al pasar a personal **sale del aula** (se descuentan `inscritos` y el contador del equipo, y se limpian `aulaId`, `brazo`, `equipo` y su código deja de figurar en el ranking). Su progreso no se borra, pero queda fuera de las exportaciones, que solo incluyen estudiantes. El panel pide confirmación antes del cambio.
- Nadie cambia su propio rol. No se puede quitar el rol al último admin.
- Cada cambio queda registrado con el evento `rol_cambiado` (detalle: rol anterior → rol nuevo).
- Mientras espera su rol, la pantalla «Unirse al aula» le indica: «Si eres parte del equipo del estudio, pide al administrador que te asigne tu rol».

**Rutas.** `/admin` (admin), `/seguimiento` (investigador, solo lectura) y `/panel` (promotor). La fase 5 pasa a ser «Panel del administrador y del investigador».

## Decisión 7 · El estudio dura 1 semana (2026-11-15)
Decidido con el equipo, para el **estudio real**. Reemplaza el calendario de 18 semanas de la especificación (secciones 1, 6, 9, 11, 13 y 14, y los criterios 5, 8, 12 y 14).

- **Días, no semanas.** `aula.fechaInicio` es el **día 1** (puede ser cualquier día, no tiene que ser lunes). El día se cuenta con la fecha de Lima. Antes del inicio es 0 o negativo; después del día 7 sigue contando y nada vuelve a cerrarse.
- **Todo abierto desde el día 1.** Cada estudiante avanza a su ritmo. Las excepciones van en `content/calendario.json` → `aperturas`: hoy **O2, la encuesta de satisfacción y O3 se abren el día 7**. *Pendiente del equipo:* confirmar si O2 se usa (el diseño descrito tiene un test antes y otro después).
- **`content/calendario.json`** concentra el cambio sin tocar los archivos del kit. Define la duración (7 días), las aperturas, el texto de fase («Día N de 7»), el semáforo, los textos de la tarjeta («Tu siguiente misión» / «Siguiente tema»), el título y la descripción del módulo de retos («Retos» / «Temas») y las insignias de racha.
- **Indicadores por día:**
  - **Racha:** días seguidos con al menos un reto completado. Las insignias pasan a **Racha 3, Racha 5 y Racha 7 días**. *Pendiente del equipo:* confirmar esos umbrales.
  - **Semáforo:** 🟢 entró hoy o ayer, 🟡 hace 2–3 días, 🔴 más de 3 días o nunca.
  - **Dosis (H3):** `dias_activos` = días 1–7 con al menos un evento `respuesta`, `completar` o `evidencia_enviada`. Reemplaza a `semanas_activas_5_16`.
- **Datos:**
  - Los eventos guardan `dia` en lugar de `semana`, y el CSV tiene la columna `dia`.
  - `usuarios.diasActivos` y `usuarios.diasConReto` se actualizan con `arrayUnion` en la misma transacción.
- **Retos:**
  - Se titulan «Reto K · {tema}» (K = 1…12).
  - Los ID siguen siendo `reto-s5…reto-s16`, y el bono de racha (+10) sigue siendo por tener completo el reto anterior.
- **Textos del kit que siguen hablando de semanas** (no se cambiaron, para que los revise el equipo): el título de O2 sigue siendo «Cuestionario de la semana 4».

## Observaciones de contenido para el equipo de investigación (sin cambiar)
- La retroalimentación de `m1-c08` contiene `<em>`. Se muestra con el mismo filtro de HTML que las lecturas.
- `m1-c10` menciona la «Misión Guardianes en Red», pero en `modulos.json` la misión se llama «Campaña del equipo» (`mision-campana`).
- La intro de la Misión 1 dice «Con 8 pistas o más, completas la misión», mientras que la insignia Explorador se gana al completarla con cualquier puntaje (ver la decisión 5).

## Notas de implementación (fase 1, 2026-11-14)
- **Microcasos de los retos.** `caso-sN` se genera como actividad propia del módulo *Retos* (con `retoId`) para guardar su progreso y contar pendientes. En la pantalla se muestra debajo de `reto-sN`, y no como una entrada aparte.
- **Módulo solo con enlaces** (Chat y comunidad). Los enlaces no tienen «completado», así que no cuentan como pendientes. En Inicio el módulo muestra «Abrir» en lugar de «N pendientes» o «Al día ✓».
- **Reglas de insignias.** `lib/juego.ts` interpreta el texto de `regla` de `config-juego.json` (formas «X completada», «X.puntaje / X.max >= n», «al menos n actividades prefijo* con responsable = true», «racha >= n», «xp >= n»). Una prueba falla si alguna regla no se reconoce.
- **Semáforo.** Cuenta días de calendario de Lima. El texto en rojo es «N d sin entrar» o «Nunca ingresó».
- **Opciones guardadas.** `progreso.respuestas[].opcion` guarda el índice **original** de la opción en el contenido. El orden barajado se calcula con `permutacion(n, uid|actividad)`.
- **Seed.** Las aulas de prueba usan los códigos fijos `EXPE26` y `CTRL26`, y empiezan el lunes de hace 6 semanas, así que están en la semana 6. La evidencia pendiente es de la «Auditoría del botiquín», que abre en la semana 7: es un dato de prueba para el panel.
- **Emuladores.** Usan el ID de proyecto `edugame-ram` (`.firebaserc`). El seed se niega a correr si los hosts no son locales.

## Notas de implementación (fase 2, 2026-11-14)
- **Sin `/ingresar`.** P01 (`/`) hace todo: detecta el navegador integrado, ingresa con ventana emergente (o por redirección si se bloquea), llama a `/api/sesion` y lleva al siguiente paso. Los errores de cuenta (dominio, retiro) se muestran allí y cierran la sesión de Google para poder cambiar de cuenta.
- **Navegadores integrados.** Además del aviso y de **Copiar enlace**, en Android se ofrece **Abrir en Chrome** (enlace `intent://`). En iPhone, la instrucción es «··· → Abrir en Safari».
- **QR del afiche sin sesión.** El código de `/unirse?codigo=…` se guarda en el navegador mientras la persona ingresa con Google, y se vuelve a precargar después.
- **Ingreso por redirección.** Los navegadores actuales bloquean el almacenamiento de terceros. En desarrollo, el emulador de Auth se conecta con el mismo host de la página (`localhost`). En producción hay un *rewrite* de `/__/auth/*` hacia `edugame-ram.firebaseapp.com`; para que funcione, en la fase 7 hay que poner `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = dominio del sitio y agregar `https://<dominio>/__/auth/handler` a los URI de redirección autorizados de OAuth.
- **Código G-XXXXX para todos.** Toda cuenta recibe su código al crearse (también el personal, que entra como estudiante). Solo se muestra a los estudiantes.
- **DOMINIOS_PERMITIDOS** solo se aplica a estudiantes y no al primer admin. Si se usa, el personal también debe ingresar con una cuenta de ese dominio (porque entra primero como estudiante).
- **Códigos de error** de unirse: `codigo_incorrecto` (404), `demasiados_intentos` (429), `aula_completa`, `aula_inactiva` y `ya_en_aula` (409). Solo los códigos incorrectos cuentan para el límite de 10 por hora.
- **`/admin` provisional** (fase 2): de momento solo tiene «Asignar un rol» y «Personal del estudio». El resto (PA1–PA7) llega en la fase 5. `/panel` y `/seguimiento` son provisionales.

## Arquitectura
- **Un solo proyecto Next.js 16 (App Router) en la raíz.** Firestore solo desde el servidor (`firebase-admin`). El navegador solo importa `firebase/auth`.
- **Envoltura `ruta()` para todos los Route Handlers:**
  - verifica el token;
  - valida la entrada con zod;
  - comprueba el rol, el retiro, el consentimiento y el aula (409 con el siguiente paso);
  - traduce los errores a `{ ok:false, error }`.
- **`lib/juego.ts`, lógica pura con pruebas:**
  - semana con la fecha de Lima, fase, apertura y fecha es-PE;
  - nivel, racha, insignias, ranking y semáforo;
  - barajado estable (PRNG con semilla = hash de uid + id);
  - XP del quiz, tope de 60 por acción y estado del módulo;
  - misión o tema de la semana, normalización de códigos y quitar el «¡…!» inicial.
- **`lib/contenido.ts` (server-only):**
  - esquemas zod;
  - genera `reto-sN` y `caso-sN` desde `retos.json`;
  - sanea por brazo: quita `correcta`, `responsable` y `feedback` mientras la opción no se ha respondido;
  - limpia el HTML con una lista blanca (`p, strong, em, ul, ol, li, b, i`).
- **Servicios sobre una interfaz de repositorio.** La vista previa usa un repositorio en memoria con un perfil ficticio, así que no escribe nada. Una prueba lo verifica.
- **Pruebas:**
  - Vitest de unidad (`juego.ts` y contenidos);
  - Vitest de la API contra el emulador, con tokens reales del emulador de Auth;
  - Playwright contra `next dev` + emuladores. El ingreso con Google se simula con una credencial falsa que acepta el emulador de Auth, y solo se habilita con `USE_FIREBASE_EMULATOR=true`.

## Estructura
```
app/  (publico)/ ingresar/ consentimiento/ unirse/ bienvenida-aula/ inicio/
      modulo/[moduloId]/ actividad/[actividadId]/ perfil/ ranking/
      panel/ panel/afiche/[aulaId]/ admin/ vista-previa/ api/**/route.ts
components/
lib/          firebase-client.ts firebase-admin.ts auth-server.ts api.ts
              contenido.ts juego.ts csv.ts servicios/
content/      (copias exactas de contenido/)
public/img/
scripts/seed.ts
tests/unit/ tests/api/ e2e/
firestore.rules firestore.indexes.json firebase.json .env.example vercel.json
```

## Dependencias
- **Las que usa la app:** next 16.4, react 19, firebase 13 (solo auth), firebase-admin 14, zod, server-only, sanitize-html y qrcode.
- **Desarrollo y pruebas:** typescript, tailwindcss 4, vitest, @playwright/test, tsx y firebase-tools.

## Fases (sección 17)
1. Base
2. Ingreso
3. Participante
4. Panel del promotor
5. Panel del administrador y del investigador (decisión 6)
6. Seguridad y pruebas
7. Despliegue

Al terminar cada fase se informa qué quedó listo y cómo probarlo.

## Notas de implementación (fase 3, 2026-11-14)
- **Resumen de progreso en `usuarios.resumen`.** Además de `progreso/{uid}/actividades/{id}`, cada usuario guarda un mapa compacto `{ estado, puntaje?, max?, responsable?, enviada? }` por actividad, que se escribe en la misma transacción. Así Inicio, Perfil y el módulo salen de 2–3 lecturas, y no de una por actividad: ayuda a quedar dentro de la cuota del plan Spark con unos 400 usuarios.
- **Almacén.** Los servicios del participante leen con un `Lector` y devuelven las escrituras, que un `Almacen` aplica en una transacción (`lib/servicios/almacen.ts`). En la fase 5, la vista previa usará un almacén en memoria que no escribe.
- **Opciones barajadas.** El navegador recibe las opciones ya ordenadas y responde con la **posición mostrada**. Nunca ve los índices originales. El servidor guarda el índice original, que es el que va a los eventos y al CSV.
- **Caso (experimental).** Si la elección no es la responsable, además de su retroalimentación se muestra la de la opción responsable bajo «Lo recomendable».
- **Reto.** Cada pregunta muestra «¡Correcto!» o «No exactamente.» más la explicación. El bono de racha (+10) se calcula al responder la tercera pregunta, si `reto-s(N−1)` está completo.
- **Misión 1.**
  - Los casos se responden en orden: el servidor rechaza saltar casos (`orden_invalido`).
  - La práctica se habilita solo después de completar la misión.
  - Si ya está completada, la intro muestra «Tu primer resultado…» con dos botones: **Repetir la misión** y **Ver mi resultado**.
- **Control.**
  - El caso comentado y la «Lectura de la semana» del reto se completan con **Marcar como leído**. En el reto, eso completa `reto-sN` y `caso-sN`.
  - La tarjeta de la semana dice «Ver ▶» (el experimental dice «Ir ▶»).
  - `/api/yo` no envía ningún dato de juego (`juego: null`).
- **Pendientes.**
  - No cuentan como pendientes: los enlaces, los podcasts sin enlace, las evaluaciones sin formulario configurado ni los microcasos.
  - El microcaso cuenta dentro de su reto: un reto está hecho cuando también lo está su microcaso.
  - Una misión de campo enviada (⏳) deja de estar pendiente.
- **Podcast y evaluación sin enlace.** No se pueden completar (`409 no_disponible`).
- **Misiones de campo.** Los campos `select` y `numero` son obligatorios; `texto` y `textarea` son opcionales, con un máximo de 800 caracteres. Solo se reenvía si el promotor la devolvió.
- **Encuentros.** Se permiten 10 códigos incorrectos por hora y encuentro (solo cuentan los fallos). Si el promotor aún no definió el código, se responde `409 sin_codigo`.
- **Seed.**
  - Las cuentas quedan vinculadas a «Google» en el emulador, así que aparecen en su ventana de ingreso.
  - El encuentro 1 tiene el código `FLEMING6`.
  - O1 y O2 tienen enlaces de ejemplo, y el aula experimental tiene un enlace de grupo de ejemplo.
- **Revisión del contenido para el control.** `npm run revision-contenido` genera `docs/REVISION_CONTENIDO.md`. Por ahora hay 12 textos con posible tono de juego («Nivel N ·», «Guardián», «equipo», «misión»). No se cambió ninguno.

## Notas de implementación (fase 4, 2026-11-15)
- **Roles desde el admin.**
  - **Actualizado el 2026-11-15 para ahorrar lecturas:** la pestaña ya no lista a todos al abrirse. El admin **busca por correo o por código** G-XXXXX (buscar a un estudiante deja un evento `consulta_identidad`).
  - **«Mostrar población»**, a demanda, lista todas las aulas con sus miembros y roles (`GET /api/admin/poblacion`). Lee un documento por usuario, más las identidades del personal. Los estudiantes aparecen solo con su código, sin correo, por eso no deja `consulta_identidad`.
  - Cada fila tiene un selector de rol con confirmación; si el rol es promotor, también se eligen sus aulas. Un cambio actualiza solo esa fila, sin volver a leer a todos.
  - El admin entra también a `/panel` (todas las aulas) y a `/seguimiento`.
- **Investigador:** usa `/seguimiento`, que es el mismo panel en modo de solo lectura (sin cambiar equipos, revisar evidencias ni editar encuentros). Puede descargar los CSV.
- **Semanas activas en `usuarios.semanasActivas`.** Cada evento `respuesta`, `completar` o `evidencia_enviada` de las semanas 5–16 agrega su semana con `arrayUnion` en la misma transacción. El panel y `participantes.csv` usan ese dato y no leen todos los eventos.
- **Evidencias.**
  - Aprobar otorga el XP de la misión una sola vez, y nunca al control. Devolver exige un comentario.
  - `validadoPor` guarda el **código G-XXXXX del promotor**, no su correo.
- **Equipos:** el servidor rechaza pasar de 5 integrantes (`409 equipo_lleno`) y registra `equipo_cambiado`.
- **Encuentros.** El código se normaliza a mayúsculas sin espacios, debe tener al menos 4 caracteres y se guarda solo su hash. Se muestra una sola vez, al guardarlo.
- **Enlaces** (grupo y encuentros): solo `http` o `https`.
- **CSV.**
  - La columna `aula` lleva el **nombre** del aula.
  - El promotor siempre indica su aula. Admin e investigador pueden exportar todas: por defecto sin las aulas de prueba, y con `incluirPrueba=1` las incluyen.
  - Para el control, `nivel` y `mision1_puntaje` van vacíos. `racha_actual` se calcula para ambos brazos, porque también mide la dosis.
  - Las celdas que empiezan con `= + - @` se neutralizan para Excel.
- **Afiche:** la URL del QR usa `NEXT_PUBLIC_URL_SITIO`; en producción debe ser el dominio real.
- **Costo de exportar todo:** a escala completa, el CSV de eventos de todas las aulas puede leer más de 100 000 documentos. Conviene exportar por aula o revisar la cuota del plan antes (lo vemos en la fase 5).

## Notas de implementación (fases 5 y 6, 2026-11-15)
- **Panel del admin con pestañas:** Aulas (PA1), Usuarios y roles, Participantes (PA4), Configuración (PA5), Vista previa (PA6) y Exportar (PA7). La pestaña queda en la URL (`/admin#aulas`). Al entrar a un aula, el admin ve el panel del promotor con «← Volver a Administración».
- **Aulas:**
  - Crear (nombre, facultad, grupo, fecha de inicio = día 1, capacidad, aula de prueba), activar o desactivar, regenerar el código (el anterior deja de funcionar) y cambiar la fecha de inicio.
  - La capacidad no puede quedar por debajo de los inscritos.
- **Participantes:**
  - **Mover** conserva el progreso, ajusta inscritos y equipos (en el experimental recibe el equipo con menos integrantes) y registra `aula_movida`. La interfaz advierte si cambia de grupo.
  - **Retirar** bloquea el ingreso y lo saca del ranking; se puede reactivar. Queda el evento `retirado`.
- **Configuración:** los enlaces aceptan el marcador `{codigo}` y se guardan tal cual; solo se admiten `http` o `https`.
- **Vista previa:**
  - `/vista-previa/...` usa las mismas pantallas del participante con un perfil ficticio (`G-VISTA`) y un aula ficticia en el día elegido.
  - La API espejo `/api/vista-previa/...` usa un almacén en memoria que **no escribe nada** (hay una prueba que lo verifica). El código de asistencia en la vista previa es `VISTA`.
  - En la vista previa la Misión 1 no exige el orden de los casos (no hay avance guardado) y no muestra el resultado final.
- **E2E (Playwright):** usan el Chrome instalado (`channel: 'chrome'`), sin descargar navegadores. Corren contra `next build && next start -p 3200` y los emuladores (`npm run test:e2e`). Cubren los criterios 1, 2, 9 y 15 (diseño a 360 px y sin errores de consola). El resto de criterios está cubierto por las pruebas de API.

## Notas del despliegue (2026-11-15)
- **Sitio de prueba en Netlify** (`edugameunac.netlify.app`). Las funciones corren en `us-east-2`; `vercel.json` (`gru1`) solo aplica en Vercel.
- **`firebase-admin` fijado en 13.x. No subir a 14 sin probar en el hosting.**
  - `firebase-admin` 14 usa `jwks-rsa` 4, que hace `require()` de `jose` 6 (solo módulo ES).
  - En las funciones de Netlify eso falla con `ERR_REQUIRE_ESM` al cargar `firebase-admin/auth`, y todas las rutas de la API responden 500.
  - Para probar una versión nueva sin desplegar: `node --no-experimental-require-module -e "require('firebase-admin/auth')"`.
- **`FIREBASE_PRIVATE_KEY`:** `clavePrivada()` en `lib/firebase-admin.ts` acepta la clave con o sin comillas, con `\n` escritos o reales, o en una sola línea.
- **Usuarios y roles:** búsqueda por correo o código y «Mostrar población» a demanda, para no leer a todos los usuarios cada vez que se abre la pestaña.
