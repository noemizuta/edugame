# EduGame RAM · Guardianes del Antibiótico — Especificación del MVP

> **Para Claude Code.** Este documento es la fuente de verdad del producto. Léelo entero, junto con `contenido/*.json`, antes de escribir código. Construye la app **desde cero** en **Next.js (App Router) + TypeScript**, con **Firebase Authentication (Google)** y **Cloud Firestore**, desplegada en **Vercel** (o Netlify). Las **reglas de investigación** (sección 3) son requisitos de un estudio científico, no preferencias de estilo. Si algo es ambiguo y cambia lo que vive un participante o los datos del estudio, pregunta antes de decidir.

---

## 0. Contenido del kit

| Ruta | Qué es | Uso |
|---|---|---|
| `docs/ESPECIFICACION.md` | Este documento | Fuente de verdad |
| `CLAUDE.md` | Resumen del proyecto y reglas que no se rompen | Dejar en la raíz del repo |
| `firebase/firestore.rules`, `firestore.indexes.json`, `.env.example` | Reglas *deny-all*, índices compuestos y plantilla de variables | Mover a la raíz del repo |
| `contenido/modulos.json` | 9 módulos y 28 actividades (lecturas, casos, misión, podcast, encuentros, misiones de campo, evaluaciones), cada una con su `semana` de apertura | Copiar a `content/` del repo; **leer solo en el servidor** |
| `contenido/retos.json` | 12 retos semanales (semanas 5–16): 3 preguntas + 1 microcaso cada uno | Igual |
| `contenido/mision1.json` | Misión 1 «Detectives del Antibiótico»: introducción, 10 casos con 4 opciones y retroalimentación por opción, y textos de resultado final | Igual. Se implementa como actividad nativa (tipo `quiz`), **sin H5P** |
| `contenido/config-juego.json` | Niveles, tabla de XP, insignias, avatares, consentimiento, aviso de derivación, mensajes de reenganche, semáforo, fases y nombres neutros del grupo control | Igual |
| `diseno/EduGame_RAM_pantallas.png` | Capturas de un prototipo anterior (referencia visual de estilo, no de arquitectura) | Seguir paleta y componentes |
| `diseno/logo-512.png`, `logo-192.png` | Logo (escudo + cápsula + «RAM») | Favicon y portada |
| `diseno/mision1-portada.jpg` | Portada de la Misión 1 | `public/img/mision1-portada.jpg` |
| `referencia/prototipo-vanilla/` | `game.js`, `app.js` y `app.css` de un prototipo en JS puro ya probado | **Solo para consultar** el comportamiento de reglas y pantallas. No portar su arquitectura (era una PWA con contraseña y datos en el cliente) |
| `referencia/Mision1_..._v2.h5p` | Versión H5P de la Misión 1 | Respaldo; no se usa en el MVP |
| `investigacion/` | Propuesta de investigación completa (Markdown y Word) | Contexto del estudio |

---

## 1. Contexto

**Qué es.** Un **sitio web** (no instalable) para un **estudio cuasiexperimental por conglomerados** de la Universidad Nacional del Callao (UNAC, Perú). El estudio evalúa si una intervención **gamificada** mejora los conocimientos, actitudes y prácticas (CAP) sobre antibióticos y resistencia antimicrobiana (RAM) en estudiantes universitarios.

**Quién educa.** Estudiantes de Enfermería de los ciclos VII–X, formados como **Promotores PRO-RAM** (educación entre pares).

**Diseño del estudio que la app debe soportar:**
- **Aulas:** cada sección del estudio es un **aula de máximo 30 estudiantes**. El aula es el conglomerado y se asigna completa a un brazo, **experimental** o **control**. En el experimental hay **equipos de 5**.
- **Fase presencial:** semanas 1–4, con 4 sesiones de 120 min dirigidas por los promotores. La app se usa en el aula: por ejemplo, la Misión 1 en la semana 1.
- **Fase a distancia:** semanas 5–16, con 10–15 min de actividad por semana más 3 encuentros virtuales (semanas 6, 10 y 14). **Esta es la fase que la app sostiene.**
- **Mediciones:** O1 (semana 0), O2 (semana 4) y O3 (semana 17), con formularios externos (Google Forms).
- **Tamaño:** unas 16 aulas y 320–480 participantes, más 16 promotores y 1–2 investigadoras.
- **Narrativa** (solo experimental): «Callao 2050». Un brote de *Klebsiella pneumoniae* resistente a carbapenémicos sale de una botica del puerto y los equipos de «Guardianes» deben contenerlo.

**Roles:**

| Rol | Qué hace |
|---|---|
| `participante`, brazo experimental | Juega: XP, niveles, racha, insignias, ranking de equipos, narrativa, misiones de campo |
| `participante`, brazo control | Ve **el mismo contenido** como material informativo, **sin ningún elemento de juego** |
| `promotor` | Gestiona solo sus aulas: semáforo de actividad, equipos, evidencias, encuentros, enlaces y exportación |
| `investigadora` | Administra todo: aulas, personal, configuración, vista previa, exportaciones y retiros |

---

## 2. Decisiones del MVP (cambios respecto al prototipo anterior)

| Tema | Decisión |
|---|---|
| Plataforma | Sitio web responsivo en **Next.js**. **No es PWA**: sin service worker, sin «instalar» ni modo sin conexión |
| Ingreso | **Solo con Google** (Firebase Authentication, proveedor Google). Nada de correo y contraseña ni cuentas creadas por script |
| Pertenencia | El participante **se une a su aula con un código de 6 caracteres** que le da su promotor. El aula define el brazo |
| Identidad | El correo de Google se guarda **aparte** (`identidades`). En todo lo demás, y en las exportaciones, el participante es un **código anónimo** generado por el servidor |
| Datos | **Firestore se usa solo desde el servidor** (firebase-admin en Route Handlers). El navegador no lee ni escribe Firestore: reglas *deny-all* |
| Respuestas correctas | **Nunca llegan al navegador antes de responder.** El servidor valida y devuelve la retroalimentación |
| Misión 1 | Actividad nativa (`quiz`) a partir de `mision1.json`. Se elimina H5P |
| Enlaces externos | Formularios O1–O3 globales (los edita la investigadora). Grupo de chat y enlaces de encuentros por aula (los edita el promotor) |
| Códigos de asistencia | Cada promotor define el código de cada encuentro para su aula; el servidor guarda solo su hash |

---

## 3. Reglas de investigación (OBLIGATORIAS)

1. **Mismo contenido, distinta forma.** El control recibe los **mismos contenidos con la misma frecuencia**. Se quitan XP, niveles, racha, insignias, ranking, narrativa «Callao 2050», Misión 1, misiones de campo, decisiones con consecuencia y el tono de juego.
2. **Desbloqueo por fecha, igual para todos.** El contenido se abre según la **semana del estudio del aula** (sección 6). El mérito solo desbloquea extras (insignias y rangos). Nada vuelve a cerrarse.
3. **Cuenta el primer intento.** Los puntos de cada actividad se otorgan **una sola vez**, con el primer intento. La práctica posterior muestra retroalimentación, pero no suma ni cambia el resultado guardado.
4. **Sin puntos negativos.** Un error muestra la explicación y no resta.
5. **Ranking solo por equipos**, con el **promedio** de XP de los integrantes y solo dentro del aula. Nunca hay ranking individual, ni códigos ni nombres en el ranking.
6. **Las evaluaciones O1–O3 no se responden ni se califican en la app.** Son formularios externos; la app registra «Ya lo respondí» (10 XP por completar, sin importar las respuestas). **La Misión 1 no es el instrumento CAP**: es una actividad educativa.
7. **Anonimato.** Fuera de `identidades`, los datos usan solo el **código anónimo**: nada de nombre, correo ni foto de Google. La foto de Google no se muestra; se usa un avatar emoji. Sigue la Ley N.º 29733 de Protección de Datos Personales del Perú.
8. **Consentimiento antes de todo.** Tras el primer ingreso con Google, el participante debe aceptar el consentimiento (`config-juego.json`, con versión y fecha registradas) **antes de unirse a un aula** o ver contenido.
9. **Derivación.** Los promotores educan, pero no diagnostican ni recomiendan medicamentos. El aviso de derivación aparece en Inicio y en «Chat y comunidad».
10. **Todo queda registrado** como evento (sección 11), para medir la participación y la hipótesis de dosis-respuesta (H3: más semanas activas se asocian a mayor retención en O3).
11. **Retiro.** La investigadora puede marcar a un participante como `retirado`. Desde entonces no puede usar la app, sale del ranking y queda marcado en las exportaciones.

---

## 4. Arquitectura y stack

| Capa | Decisión |
|---|---|
| Framework | **Next.js**, última versión estable, con App Router y **TypeScript** estricto |
| Estilos | **Tailwind CSS** con los tokens de la sección 15. Sin librerías de componentes pesadas: debe ir rápido en celulares Android económicos |
| Autenticación (cliente) | Firebase JS SDK modular, **solo el módulo `auth`**, con `GoogleAuthProvider` y `signInWithPopup` (y `signInWithRedirect` como respaldo si el navegador bloquea la ventana emergente) |
| Servidor | Route Handlers (`app/api/**/route.ts`) con **firebase-admin**. Cada solicitud lleva `Authorization: Bearer <ID token>`, que se verifica con `verifyIdToken` |
| Base de datos | **Cloud Firestore**, región `southamerica-east1` (São Paulo). Solo la usa el servidor |
| Contenido | JSON en `content/` del repo, cargados y **validados con zod** en el servidor. El cliente recibe versiones **saneadas** (sin `correcta`, `responsable` ni `feedback`) |
| Validación de entrada | zod en cada endpoint |
| Hosting | **Vercel** (recomendado): funciones en la región `gru1` (São Paulo), cerca de Firestore. Netlify también funciona (adaptador de Next.js) |
| Desarrollo local | **Firebase Emulator Suite** (Auth + Firestore) y un script `seed` con datos de prueba |
| Pruebas | **Vitest** (reglas del juego, contenidos y API contra el emulador) y **Playwright** (E2E contra el emulador) |

**Estructura sugerida:**
```
app/
  (publico)/page.tsx                 P01 Bienvenida + «Entrar con Google»
  ingresar/                          manejo de login / navegador incompatible
  consentimiento/                    P02
  unirse/                            P03 (acepta ?codigo=XXXXXX)
  bienvenida-aula/                   P04 avatar + equipo
  inicio/                            P05
  modulo/[moduloId]/                 P06
  actividad/[actividadId]/           P07 (según tipo)
  perfil/                            P08
  ranking/                           P09
  panel/                             PP1… (promotor)
  admin/                             PA1… (investigadora)
  vista-previa/                      PA6
  api/…                              sección 12
lib/
  firebase-client.ts                 solo auth
  firebase-admin.ts                  admin + firestore
  auth-server.ts                     requireUser(), requireRol()
  contenido.ts                       carga, valida, sanea (server-only)
  juego.ts                           reglas puras: semana, nivel, racha, insignias, ranking, semáforo, barajado
  csv.ts
content/                             los JSON del kit
scripts/seed.ts                      datos de prueba para el emulador
```
Marca `lib/contenido.ts` y `lib/firebase-admin.ts` con `import 'server-only'`.

---

## 5. Ingreso, aulas y roles

### 5.1 Flujo del participante

```
P01 Bienvenida → «Entrar con Google»
   → POST /api/sesion  (crea usuario si no existe; rol según 5.3)
   → sin consentimiento       → P02 Consentimiento
   → sin aula                 → P03 Unirse al aula (código de 6 caracteres)
   → aula sin avatar elegido  → P04 Bienvenida al aula (avatar; equipo si es experimental)
   → P05 Inicio
```
- **Navegadores integrados (in-app):** si se abre el enlace desde WhatsApp, Telegram, Instagram o Facebook, Google bloquea el ingreso (`disallowed_useragent`). Detecta estos navegadores por el *user agent* y, **antes** de intentar ingresar, muestra: «Para ingresar con Google, abre este enlace en Chrome o Safari», con un botón **Copiar enlace** e instrucciones («⋮ → Abrir en el navegador»).
- **Ventana emergente bloqueada:** si `signInWithPopup` falla con `auth/popup-blocked`, reintenta con `signInWithRedirect`.
- **Dominios permitidos** (opcional): si existe la variable de entorno `DOMINIOS_PERMITIDOS` (por ejemplo `unac.edu.pe`), solo esas cuentas pueden crear una sesión. Las demás ven «Usa tu cuenta institucional».

### 5.2 Unirse a un aula
- El código del aula tiene **6 caracteres** del alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sin 0/O ni 1/I). No distingue mayúsculas, ignora espacios y es único.
- `/unirse?codigo=K7Q2PX` precarga el código (lo usa el QR del afiche del aula).
- El servidor, en una **transacción**:
  1. busca `codigosUnion/{CODIGO}`;
  2. verifica que el aula esté `activa`;
  3. verifica que el participante no esté ya en otra aula (si lo está: «Ya perteneces al aula X. Si es un error, habla con tu promotor»);
  4. verifica `inscritos < capacidad` (30). Si está llena: «Esta aula está completa. Consulta con tu promotor»;
  5. asigna `aulaId` y `brazo` (copiado del aula);
  6. solo en el experimental, asigna un **equipo** al que tenga menos integrantes entre `E1…E6`, desempatando por el número menor;
  7. incrementa `inscritos` y el contador del equipo;
  8. registra el evento `unirse_aula`.
- **Límite de intentos:** 10 códigos incorrectos por usuario cada hora. Después: «Demasiados intentos, espera unos minutos».
- El participante **no puede cambiarse** de aula. Solo la investigadora puede moverlo (PA4).

### 5.3 Roles del personal
- **Investigadora:** los correos listados en la variable de entorno `INVESTIGADORA_EMAILS` (separados por comas) reciben `rol = investigadora` al crear su sesión.
- **Promotor:** la investigadora lo invita por correo (PA3), creando `invitacionesStaff/{correo}` con `{ rol: 'promotor', aulas: [aulaId…] }`. La primera vez que esa cuenta de Google ingresa, `/api/sesion` la convierte en promotor con esas aulas y marca la invitación como usada. La investigadora puede agregar o quitar aulas después.
- El personal **no pasa** por consentimiento ni por la unión a un aula: va directo a `/panel` (promotor) o `/admin` (investigadora).
- Nadie cambia su propio rol, aula, brazo ni equipo: solo el servidor.

### 5.4 Código anónimo del participante
Al crear el usuario, el servidor genera un código **único** con el formato `G-XXXXX` (5 caracteres del mismo alfabeto). La unicidad se reserva con `codigosParticipante/{codigo}` dentro de una transacción. Es el que aparece en la app, en las exportaciones y el que el participante copia en los formularios O1–O3.

---

## 6. Calendario y desbloqueo

- **Semana del estudio** = `floor((hoy − aula.fechaInicio) / 7 días)`, con `aula.fechaInicio` igual al **lunes de la semana 0**, calculada con la fecha local de **America/Lima** (UTC−5, sin horario de verano). Puede ser negativa (antes del inicio) y llega hasta la semana 18.
- Un módulo o actividad está **abierto** si `semana ≥ item.semana`. Si un módulo tiene `brazos`, solo lo ve ese brazo; lo mismo para cada actividad.
- **Texto de fase:** lo da `config-juego.json` → `fases` (por ejemplo, «Semana 6 · Fase a distancia»).
- **Estado de un módulo en Inicio:**
  - abierto con pendientes: «N pendientes»;
  - abierto y todo completado: «Al día ✓»;
  - abierto, pero con todas sus actividades aún cerradas: «Próxima: 19 abr.»;
  - cerrado: 🔒 «Se abre el 12 abr.».
- **Fechas** en formato `es-PE` corto («12 abr.»).
- Una actividad cerrada no se puede abrir ni responder: el servidor responde `403 actividad_cerrada` aunque se escriba la URL a mano.
- **Misión de la semana** (experimental) o **Tema de la semana** (control): la primera actividad abierta y no completada, en el orden de `modulos.json`, sin contar las de tipo `enlace`. Si no queda ninguna: «¡Estás al día! Vuelve el lunes». Antes del inicio: «El estudio aún no empieza».

---

## 7. Pantallas

### 7.1 Participante

| ID | Ruta | Contenido | Acción |
|---|---|---|---|
| P01 | `/` | Leyenda «Universidad Nacional del Callao», título **EduGame RAM**, logo, subtítulo **Guardianes del Antibiótico**, lema «Aprende, juega y protege los antibióticos», botón **Entrar con Google** | Ingresa |
| P02 | `/consentimiento` | Texto de `config-juego.json` → `consentimiento`, casilla «Acepto participar» y botón **Continuar** (desactivado hasta marcar) | `POST /api/consentimiento` |
| P03 | `/unirse` | «Ingresa el código de tu aula» (campo de 6 caracteres, mayúsculas automáticas) y la ayuda «Te lo da tu promotor PRO-RAM» | `POST /api/aulas/unirse` |
| P04 | `/bienvenida-aula` | «Te uniste a {aula.nombre}». Elige avatar (8 emojis). Experimental: «Eres parte del equipo E3. Juntos sumarán puntos en el ranking». Muestra el **código anónimo** («Tu código de participante es G-7K3PX; lo usarás en los cuestionarios») | Guarda el avatar y entra a Inicio |
| P05 | `/inicio` | Ver detalle abajo | Entra a un módulo |
| P06 | `/modulo/[id]` | Icono, título (o `tituloControl`), descripción y lista de actividades con ✅, ▶ o 🔒 y la fecha de apertura | Abre una actividad |
| P07 | `/actividad/[id]` | Según el tipo (sección 8) | Responde o completa |
| P08 | `/perfil` | Avatar (cambiable), código anónimo, aula, equipo (experimental). Experimental: XP, rango, racha e **insignias** (ganadas y bloqueadas, con su criterio). Aviso de derivación. **Cerrar sesión** | |
| P09 | `/ranking` | Solo experimental: equipos del aula por XP promedio, con 🥇🥈🥉, el propio resaltado, «N integrantes» y la nota «No hay ranking individual: aquí gana el trabajo en equipo». El control que entra aquí vuelve a `/inicio` | |

**P05 Inicio, experimental:**
- Encabezado con «Guardianes del Antibiótico» y la pastilla «N XP · Rango» (lleva a Perfil).
- Texto de fase.
- **Tarjeta del héroe:** avatar, rango, barra de XP con `role="progressbar"` («N XP · faltan M para Agente»), 🔥 racha y 👥 equipo.
- **Tarjeta Misión de la semana** (amarilla, «Ir ▶»).
- Módulos agrupados por `grupo`: *Aprender*, *Jugar y actuar*, *Conectar*, *Mi progreso*.
- Aviso de derivación al pie.

**P05 Inicio, control:**
- Encabezado «Aprende sobre antibióticos», saludo «Hola, G-7K3PX» y «Contenidos sobre uso responsable de antibióticos».
- **Tarjeta Tema de la semana.**
- Módulos con `tituloControl`; el grupo «Jugar y actuar» se llama «Actividades».
- Sin XP, rango, racha, equipo ni ranking.
- Aviso de derivación.

**Navegación inferior fija:**
- Experimental: Inicio · Ranking · Perfil.
- Control: Inicio · Perfil.

### 7.2 Promotor (`/panel`)
Si tiene varias aulas, un selector arriba. Pestañas:

| ID | Pestaña | Contenido |
|---|---|---|
| PP1 | **Mi aula** | Nombre, brazo y **código de unión** (con botones *Copiar* e *Imprimir afiche*: página A4 con la URL `/unirse?codigo=…` en QR, el código grande y 3 pasos: «Abre el enlace en Chrome o Safari → Entra con Google → Escribe el código»), inscritos/capacidad y semana actual. Contadores 🟢🟡🔴. Tabla: código, equipo, XP (experimental), semanas activas, último acceso con semáforo y botón **Copiar mensaje** (🟡/🔴) con la plantilla de reenganche |
| PP2 | **Equipos** (solo experimental) | Participantes con un selector de equipo E1–E6 y el tamaño de cada equipo (máximo 5; advierte si se excede). Se usa en la sesión presencial 1 para que los equipos de la app coincidan con los del aula |
| PP3 | **Evidencias** | Tarjetas de las misiones de campo pendientes: misión, código, equipo y campos. Comentario (**obligatorio para devolver**). Botones **Aprobar** (otorga el XP de la misión) y **Devolver** |
| PP4 | **Encuentros** | Para los encuentros 1–3: enlace de Meet o Zoom y **código de asistencia** (mínimo 4 caracteres; se muestra solo al guardarlo). Además, el campo **Grupo del aula** (enlace de Telegram o WhatsApp) |
| PP5 | **Exportar** | CSV de eventos y CSV de participantes de su aula |

**Semáforo** (por `ultimoAcceso`): 🟢 hasta 7 días («Hoy» / «Hace N d»), 🟡 de 8 a 14 días («N d sin entrar»), 🔴 más de 14 días o nunca. Protocolo indicado bajo la tabla: 🟡 → mensaje; 🔴 → mensaje personal y llamada breve.

### 7.3 Investigadora (`/admin`)

| ID | Pestaña | Contenido |
|---|---|---|
| PA1 | **Aulas** | Crear aula (nombre, facultad, brazo, fecha de inicio = lunes de la semana 0, capacidad 30, casilla «Aula de prueba»). Lista con código, brazo, inscritos y semana. Acciones: activar/desactivar, regenerar código, cambiar fecha de inicio. Al entrar a un aula, ve lo mismo que su promotor (PP1–PP5) |
| PA2 | **Personal** | Promotores (correo, aulas, si ya ingresó) e invitaciones pendientes |
| PA3 | **Invitar** | Correo y aulas → invitación de promotor |
| PA4 | **Participantes** | Buscar por código o por correo (solo aquí se ve el correo, y queda registrado como evento `consulta_identidad`). Acciones: **mover de aula** (con confirmación y evento) y **marcar como retirado** |
| PA5 | **Configuración** | Enlaces de O1, O2, satisfacción y O3. Admiten el marcador `{codigo}` para prellenar el código en Google Forms (ejemplo: `…viewform?usp=pp_url&entry.123456={codigo}`). Servicio médico |
| PA6 | **Vista previa** | Elige brazo (experimental o control) y semana (0–18) y recorre la interfaz del participante con un perfil ficticio, **sin escribir datos** (las respuestas devuelven retroalimentación con un aviso «Vista previa») |
| PA7 | **Exportar** | CSV de todas las aulas, o filtrado por aula; casilla «incluir aulas de prueba» (desmarcada por defecto) |

---

## 8. Actividades (por tipo)

El contenido de cada tipo está en `modulos.json`, `retos.json` y `mision1.json`. Los ID de actividad no llevan puntos.

| Tipo | Experimental | Control | XP |
|---|---|---|---|
| `lectura` | HTML del JSON y botón **Marcar como leído** | Igual | 0 (registra completado) |
| `quiz` (Misión 1) | Ver 8.1 | No aparece; el control tiene la lectura «10 ideas clave» | `round(aciertos/10 × 40)` |
| `caso` | Escena y 3 opciones barajadas de forma estable (semilla = uid + id de la actividad); «¿Qué debería hacer?». Al elegir, el servidor responde: la responsable en verde, la elegida en rojo si falló, y la retroalimentación. **Una sola elección**; al volver se muestra el resultado guardado | **Caso comentado:** escena, «Lo recomendable: …», su explicación y «Por qué no las otras opciones», con la retroalimentación **sin la frase inicial de juego** (se quita el `¡…!` del comienzo). **Marcar como leído** | 15 si es responsable |
| `reto` (generado desde `retos.json`; id `reto-sN`, semana N, título «Semana N · {tema}») | 3 preguntas con opciones barajadas; cada respuesta recibe retroalimentación inmediata del servidor («¡Correcto!» o «No exactamente.» + explicación). Al responder las 3: `10 × aciertos` **+ 10 de racha** si `reto-s(N−1)` está completo. Debajo va el **microcaso** `caso-sN`, que funciona como un `caso` | **Lectura de la semana:** cada pregunta con su respuesta correcta y explicación, más el caso con lo recomendable. **Marcar como leído** (completa `reto-sN` y `caso-sN`) | 10 por acierto, +10 de racha, +15 por el microcaso |
| `audio` | Reproductor si el enlace es mp3, m4a u ogg; si no, botón «Escuchar ▶». **Marcar como escuchado**. Sin enlace: «Disponible pronto» | Igual | 5 |
| `enlace` | Abre el enlace resuelto con `enlaceConfig` (`aula.enlaceGrupo`). Muestra el aviso de derivación. Sin enlace: «Tu promotor compartirá el enlace pronto» | Igual | 0 |
| `evaluacion` | «Cuando el formulario te lo pida, escribe tu código: **G-7K3PX**», botón «Abrir cuestionario ▶» (enlace de `config/estudio` con `{codigo}` reemplazado) y **Ya lo respondí**. Sin enlace configurado: «El enlace se activará en la fecha de la evaluación» | Igual | 10 |
| `encuentro` | Enlace del encuentro del aula y campo **Código de asistencia**. El servidor compara el hash (en mayúsculas y sin espacios) con el definido por el promotor. Si no coincide: «Código incorrecto. Revisa con tu promotor» | Igual | 20 |
| `mision` | Instrucciones y formulario con los campos del JSON (`select`, `numero`, `texto`, `textarea`; máximo 800 caracteres). Al enviar queda **pendiente**. Estados: ⏳ «Enviada. Tu promotor la revisará pronto» · ↩️ «Tu promotor te pide revisar: «comentario»» (puede reenviar) · ✅ «Misión validada · +30 XP» | No aparece | 30 (campaña: 50) **cuando el promotor la aprueba** |

**Reglas comunes:**
- Para el **control** no se otorga XP, pero sí se registran la actividad completada y los eventos (dosis de contacto).
- **Máximo 60 XP por acción** (el servidor lo garantiza).
- Al ganar XP aparece un *toast* «+N XP».

### 8.1 Misión 1 (`quiz`, experimental)
1. **Introducción:** portada, título y los párrafos de `mision1.intro`; botón «¡Comenzar la misión!». Si ya está completada, dice «Tu primer resultado: 7/10. Puedes repetir para practicar; los puntos ya se contaron».
2. **Casos:** 10, en un **orden barajado de forma estable** por usuario. Muestra «Caso N de 10», escena, pregunta y 4 opciones barajadas. Al elegir, el servidor devuelve si es correcta, cuál era la correcta y la retroalimentación de la opción elegida (y la de la correcta, si falló). Luego **Siguiente**. **No se puede volver atrás**.
3. **Interrupción:** si el participante sale y vuelve, sigue desde el primer caso sin responder (el progreso se guarda en el servidor).
4. **Resultado:** «Resultado de la misión: N de 10 casos resueltos», el texto de `resultadoFinal` según el porcentaje, una tabla de casos con ✓/✗ y el XP ganado. Con 8 o más, la insignia Detective.
5. **Práctica:** tras completarla, **Repetir la misión** usa `modo: 'practica'`: el servidor devuelve la retroalimentación sin guardar el resultado (solo registra eventos `practica`).

---

## 9. Gamificación (solo experimental)

- **Niveles:** Recluta 0 · Agente 200 · Guardián 450 · Guardián Una Salud 800. El máximo posible ronda los 1 285 XP.
- **Racha:** semanas consecutivas con `reto-sN` completo, contadas hacia atrás desde la semana actual (si el de esta semana aún no está hecho, desde la anterior); mínimo semana 5.
- **Insignias:** las 11 de `config-juego.json` → `insignias`. Se **calculan** desde el progreso; no se guardan.
- **Ranking:** promedio de XP por equipo, solo con los participantes experimentales del aula que no estén retirados.
- **Tono:** las retroalimentaciones del experimental conservan las frases de juego («¡Decisión de Guardián!»).

---

## 10. Contenidos

- Se cargan en el servidor desde `content/` y se validan con **zod** al iniciar. Además, una prueba de Vitest falla si:
  - un ID se repite o tiene puntos;
  - una semana está fuera de 0–18;
  - un reto no tiene exactamente 3 preguntas, o alguna no tiene `correcta` dentro del rango;
  - un caso no tiene exactamente una opción `responsable`;
  - un caso de la Misión 1 no tiene exactamente una opción `correcta`;
  - una misión no tiene campos.
- El HTML de las lecturas es de confianza (lo escribe el equipo). Permite solo `p, strong, em, ul, ol, li, b, i` y sanéalo de todas formas.
- **El contenido microbiológico debe validarlo el equipo de investigación antes del piloto.** No inventes ni cambies contenidos científicos. Si encuentras un error, anótalo y pregunta.

---

## 11. Modelo de datos (Firestore, solo servidor)

```
usuarios/{uid}
  codigo: 'G-7K3PX', rol: 'participante'|'promotor'|'investigadora',
  aulaId: string|null, brazo: 'experimental'|'control'|null, equipo: 'E1'..'E6'|null,
  aulasPromotor: string[]                 // solo promotor
  avatar: string|null, consentimiento: {version, fecha}|null,
  xp: number, ultimoAcceso: Timestamp|null, retirado: boolean, creado: Timestamp

identidades/{uid}                        // SOLO servidor; nunca en exportaciones
  email, nombreGoogle, creado, ultimoIngreso

codigosParticipante/{codigo} → { uid }
codigosUnion/{CODIGO6} → { aulaId }

aulas/{aulaId}
  nombre, facultad, brazo, fechaInicio: 'AAAA-MM-DD', capacidad: 30, inscritos: number,
  equipos: { E1: n, …, E6: n }, codigoUnion, activa: boolean, prueba: boolean,
  enlaceGrupo: string|null, creadoPor, creado
aulas/{aulaId}/encuentros/{enc-1|enc-2|enc-3}
  enlace: string|null, codigoHash: string|null (SHA-256 del código normalizado), actualizadoPor, actualizado

progreso/{uid}/actividades/{actividadId}
  estado: 'en_curso'|'completada', xp, puntaje?, max?, correctas?,
  respuestas: { [preguntaOCaso]: { opcion, correcta, en } },
  opcion?, responsable?, completadaEn, validadoPor?

evidencias/{autoId}
  uid, codigo, aulaId, equipo, misionId, campos: {}, estado: 'pendiente'|'aprobada'|'devuelta',
  comentario, validadoPor (código o correo del promotor), validadoEn, creado

eventos/{autoId}                         // solo se agregan
  ts (serverTimestamp), uid, codigo, aulaId, brazo, equipo, rol, semana,
  tipo, modulo?, actividadId?, pregunta?, opcion?, correcta?, puntaje?, max?, xp?, detalle?

invitacionesStaff/{correoEnMinusculas}
  rol: 'promotor', aulas: string[], creadoPor, creado, usada: boolean, usadaPor?

config/estudio
  enlaces: { o1, o2, satisfaccion, o3, servicioMedico }, actualizadoPor, actualizado

limites/{uid}                            // contador de intentos de código de aula
```

**Tipos de evento:** `sesion`, `consentimiento`, `unirse_aula`, `avatar`, `ver_modulo`, `ver_item`, `respuesta`, `practica`, `completar`, `abrir_enlace`, `abrir_evaluacion`, `asistencia_intento`, `evidencia_enviada`, `evidencia_aprobada`, `evidencia_devuelta`, `equipo_cambiado`, `aula_movida`, `retirado`, `consulta_identidad`.

**Índices compuestos:**
- `eventos` (`aulaId` ASC, `ts` ASC);
- `evidencias` (`aulaId` ASC, `estado` ASC, `creado` ASC);
- `usuarios` (`aulaId` ASC, `rol` ASC).

Guárdalos en `firestore.indexes.json`.

**`firestore.rules`:** denegar todo al cliente (`allow read, write: if false;`). La app solo usa firebase-admin.

**Consistencia:**
- Otorgar XP es una **transacción**: lee `progreso/{uid}/actividades/{id}`; si ya está `completada`, no hace nada; si no, escribe el progreso e incrementa `usuarios.xp`.
- `ultimoAcceso` se actualiza en `/api/sesion` como máximo una vez por hora.

---

## 12. API (Route Handlers)

Todas exigen el token de Firebase (salvo que se indique otra cosa), validan la entrada con zod y responden JSON `{ ok, … }` o `{ ok: false, error: 'codigo_legible' }`. Los retirados reciben `403 retirado`. Los participantes sin consentimiento o sin aula reciben `409` con la siguiente pantalla que les corresponde.

**Participante:**

| Método y ruta | Qué hace |
|---|---|
| `POST /api/sesion` | Crea o actualiza `usuarios` e `identidades`, asigna el rol (5.3) y devuelve `{ rol, siguientePaso, perfil }` |
| `POST /api/consentimiento` | `{ version }` |
| `POST /api/aulas/unirse` | `{ codigo }` (5.2) |
| `PATCH /api/perfil` | `{ avatar }` |
| `GET /api/yo` | Perfil, aula (nombre, brazo, enlaceGrupo), semana, fase, nivel, racha, insignias, misión de la semana y módulos con su estado |
| `GET /api/modulos/[id]` | Módulo y actividades saneadas con su estado |
| `GET /api/actividades/[id]` | Actividad saneada para el brazo, más el estado previo (respuestas y retroalimentaciones ya obtenidas) |
| `POST /api/actividades/[id]/responder` | `{ pregunta?, opcion, modo?: 'normal'\|'practica' }` → `{ correcta, opcionCorrecta, feedback, completada?, xpOtorgado? }`. Para `caso`, `reto` y `quiz` |
| `POST /api/actividades/[id]/completar` | `lectura`, `audio` y `evaluacion` (y la lectura del reto en el control) |
| `POST /api/actividades/[id]/asistencia` | `{ codigo }` |
| `POST /api/evidencias` · `GET /api/evidencias/mias` | Misiones de campo |
| `GET /api/ranking` | Solo experimental: `[{ equipo, promedio, integrantes }]` |
| `POST /api/eventos` | `{ tipo: 'ver_modulo'\|'ver_item'\|'abrir_enlace'\|'abrir_evaluacion', modulo?, actividadId? }`. El servidor completa aula, brazo, equipo y semana |

**Promotor** (solo sus aulas; la investigadora, todas):

| Método y ruta | Qué hace |
|---|---|
| `GET /api/panel/aulas` | Sus aulas con datos resumidos |
| `GET /api/panel/aulas/[aulaId]/participantes` | Código, equipo, XP, semanas activas, último acceso y semáforo |
| `PATCH /api/panel/participantes/[uid]/equipo` | `{ equipo }`, con máximo 5 por equipo |
| `GET /api/panel/evidencias?aulaId=` · `POST /api/panel/evidencias/[id]` | `{ accion: 'aprobar'\|'devolver', comentario }` |
| `PUT /api/panel/aulas/[aulaId]/encuentros/[encId]` | `{ enlace?, codigo? }` (guarda el hash) |
| `PATCH /api/panel/aulas/[aulaId]` | `{ enlaceGrupo }` |
| `GET /api/export/eventos.csv?aulaId=` · `GET /api/export/participantes.csv?aulaId=` | Exportaciones |

**Investigadora:**

| Método y ruta | Qué hace |
|---|---|
| `POST /api/admin/aulas` · `PATCH /api/admin/aulas/[id]` | `{ activa?, fechaInicio?, nombre?, regenerarCodigo? }` |
| `GET/POST/DELETE /api/admin/invitaciones` · `PATCH /api/admin/personal/[uid]` | `{ aulasPromotor }` |
| `GET /api/admin/participantes?q=` | Busca por código o correo |
| `POST /api/admin/participantes/[uid]/mover` | `{ aulaId }` |
| `POST /api/admin/participantes/[uid]/retirar` | Marca el retiro |
| `GET/PUT /api/admin/config` | Enlaces de evaluaciones y servicio médico |
| `GET /api/vista-previa/...` | Mismas respuestas que la API del participante, con un perfil ficticio (`?brazo=&semana=`) y **sin escritura** |

**Seguridad:**
- Verifica el rol en cada endpoint.
- El promotor solo opera sobre aulas incluidas en `aulasPromotor`.
- Límite de intentos en `unirse` (10 por hora) y en `asistencia` (10 por hora y actividad).
- Las respuestas de error nunca filtran respuestas correctas, correos ni datos de otros participantes.

---

## 13. Exportaciones CSV

UTF-8 con BOM (para Excel), separador coma y fechas en ISO UTC más una columna con la fecha y hora en Lima. **Sin correos ni nombres.** Por defecto excluyen las aulas de prueba.

**`eventos.csv`:** `ts_utc, fecha_lima, codigo, aula, facultad, brazo, equipo, rol, semana, tipo, modulo, actividadId, pregunta, opcion, correcta, puntaje, max, xp, detalle`.

**`participantes.csv`:** `codigo, aula, facultad, brazo, equipo, xp, nivel, actividades_completadas, retos_completados, racha_actual, semanas_activas_5_16, mision1_puntaje, ultimo_acceso, consentimiento_fecha, retirado`.

`semanas_activas_5_16` = número de semanas distintas, entre la 5 y la 16, con al menos un evento `respuesta`, `completar` o `evidencia_enviada`. Es la variable de **dosis** para la hipótesis H3.

---

## 14. Configuración y despliegue

**Variables de entorno (`.env.example`):**
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=            # con \n escapados; reemplazar por saltos de línea al leer
INVESTIGADORA_EMAILS=            # correo1@...,correo2@...
DOMINIOS_PERMITIDOS=             # opcional, p. ej. unac.edu.pe
NEXT_PUBLIC_URL_SITIO=           # https://edugame-ram.vercel.app (para el QR)
USE_FIREBASE_EMULATOR=           # true en desarrollo
```

**Configurar Firebase** (documéntalo en el README, en español):
1. Crear el proyecto (sin Analytics).
2. **Authentication → Google**, activar y elegir el correo de asistencia.
3. **Authentication → Configuración → Dominios autorizados:** agregar el dominio de Vercel o Netlify y el dominio propio, si existe.
4. Crear **Firestore** en `southamerica-east1`, modo producción.
5. Registrar la app web y copiar las variables `NEXT_PUBLIC_*`.
6. **Cuentas de servicio → Generar nueva clave privada** y copiar sus valores a las variables `FIREBASE_*` del hosting. **Nunca** se sube al repositorio.
7. `firebase deploy --only firestore:rules,firestore:indexes`.

**Vercel:**
- Importar el repositorio y cargar las variables.
- Región de funciones `gru1` (en `vercel.json`).
- Revisar que los términos del plan elegido permitan el uso del proyecto.

**Netlify:** compatible con el adaptador oficial de Next.js. La región de funciones depende del plan.

**Costos:** Firebase Auth y Firestore deberían alcanzar en el plan gratuito Spark para unos 400 usuarios (unas 50 000 lecturas y 20 000 escrituras por día). Hay que verificar las cuotas vigentes y los límites de funciones del hosting antes del piloto.

**Desarrollo local:**
- `firebase emulators:start --only auth,firestore` (requiere Java).
- `npm run seed` crea:
  - 1 investigadora y 2 promotores;
  - 2 aulas, una experimental y otra control, con fecha de inicio hace 6 semanas;
  - 8 participantes con progreso variado y últimos accesos de 0, 3, 9 y 20 días;
  - 1 evidencia pendiente.
- `npm run dev`.

---

## 15. Diseño visual

Referencia: `diseno/EduGame_RAM_pantallas.png`.

- **Colores (tokens de Tailwind):**

  | Token | Valor |
  |---|---|
  | `fondo` | `#0b1f4d` |
  | `fondo-2` | `#13306e` |
  | `amarillo` | `#f6b81a` |
  | `cian` | `#37d3f0` |
  | `rosa` | `#e2407e` (botones de ingreso) |
  | `verde` | `#20a464` (correcto) |
  | `rojo` | `#d93a3a` (incorrecto) |
  | `tinta` | `#10223f` (texto sobre tarjetas blancas) |

- **Módulos:** «píldoras» amarillas o cian según `color` del JSON, con ícono, título, estado y un círculo negro con ▶. Cuadrícula de 2 columnas en el celular y 3 desde 560 px. Un módulo cerrado se ve translúcido, con 🔒.
- **Héroe:** degradado azul, avatar en un círculo con borde cian, rango en amarillo y barra de XP de cian a amarillo.
- **Opciones de respuesta:** tarjetas grandes (mínimo 44 px de alto). Correcta en verde suave con borde verde; la elegida incorrecta en rojo suave; las demás atenuadas. Retroalimentación en una caja verde o ámbar.
- **Celular primero**, desde 360 px de ancho, con navegación inferior fija y `safe-area-inset-bottom`. Fuente del sistema.
- **Accesibilidad:** contraste AA, foco visible, `prefers-reduced-motion` y textos alternativos.
- **Idioma:** español del Perú. Tono de juego en el experimental y neutro en el control.

---

## 16. Fuera del MVP (fase 2)
- Notificaciones (correo o push); por ahora los avisos van por el grupo del aula.
- Bonus cooperativo de sección.
- Foro interno.
- Subida de fotos de evidencias.
- Escape room en línea (semana 15).
- Bot de Telegram.
- Edición de contenidos desde el panel.

---

## 17. Fases de trabajo
1. **Base:** Next.js + TS + Tailwind, estructura, `lib/juego.ts` con **pruebas Vitest**, carga y validación de contenidos con su prueba, emuladores y `seed`.
2. **Ingreso:** Google, `/api/sesion`, detección de navegadores integrados, consentimiento, unirse al aula, avatar y roles del personal.
3. **Participante:** Inicio, módulos y todos los tipos de actividad (incluida la Misión 1) en ambos brazos; perfil y ranking.
4. **Panel del promotor:** PP1–PP5, incluido el afiche con QR y la exportación CSV.
5. **Panel de la investigadora:** PA1–PA7, incluida la vista previa.
6. **Seguridad y pruebas:** reglas *deny-all*, límites de intentos, pruebas de la API contra el emulador y **E2E con Playwright** de los criterios de la sección 18.
7. **Despliegue:** Vercel y `README.md` en español con todos los pasos de configuración.

Al terminar cada fase, resume qué quedó listo y qué falta.

---

## 18. Criterios de aceptación
1. **Primer ingreso:** una cuenta nueva entra con Google → consentimiento obligatorio → código de aula → avatar → Inicio. El participante recibe un código `G-XXXXX` y en Firestore no hay correo fuera de `identidades`.
2. **Navegador integrado:** con el *user agent* de WhatsApp aparece el aviso «Abre en Chrome o Safari» y no se intenta ingresar.
3. **Aula:** un código incorrecto da error; el intento 11 en una hora se bloquea; un aula con 30 inscritos rechaza al número 31; quien ya pertenece a un aula no puede unirse a otra.
4. **Equipos:** en un aula experimental, 12 uniones consecutivas dejan los equipos con 2 integrantes en E1–E6 (balanceo). En el control, `equipo` queda en `null`.
5. **Desbloqueo** (aula en la semana 6): están abiertos Laboratorio, Botica, Retos, Voces, Caso, Misiones («Próxima: …»), Encuentros, Chat y Evaluaciones. En la semana 0 solo Chat y Evaluaciones. Pedir una actividad cerrada por URL devuelve 403.
6. **Sin respuestas en el navegador:** las respuestas de `GET /api/actividades/*` no contienen `correcta`, `responsable` ni `feedback` de opciones no respondidas (hay una prueba automatizada).
7. **Misión 1:** 10 casos en orden estable; se retoma tras recargar; el XP es `round(aciertos/10 × 40)` y se otorga una sola vez; la práctica no cambia el XP; con 8/10 o más aparece la insignia Detective.
8. **Reto de la semana 6:** retroalimentación inmediata; XP = 10 × aciertos (+10 si `reto-s5` está completo); el microcaso responsable suma 15.
9. **Control:** no ve XP, rango, racha, equipo, ranking, insignias, Misión 1, Caso Callao 2050 ni Misiones. Ve «Lecturas», «Casos comentados» y «Tema de la semana», sin frases de juego. `/ranking` lo devuelve a Inicio. Sus actividades completadas sí se registran.
10. **Misión de campo:** el participante envía (⏳); el promotor intenta devolverla sin comentario y no puede; la aprueba; el participante ve ✅, recibe +30 XP y la insignia Auditor.
11. **Encuentro:** el promotor define el código «fleming6»; el participante falla con «otro» y acierta con «FLEMING6 »; suma +20 una sola vez.
12. **Panel:** el semáforo muestra los 3 colores con los datos del `seed`; «Copiar mensaje» copia la plantilla con el código; el afiche del aula muestra el QR con `/unirse?codigo=…`; el promotor no puede abrir el aula de otro promotor (403).
13. **Investigadora:** crea un aula; invita a un promotor por correo, que al ingresar ve esa aula; mueve un participante; lo retira, y ese participante queda bloqueado y fuera del ranking; la vista previa no escribe nada en Firestore.
14. **CSV:** las columnas de la sección 13, sin correos; `semanas_activas_5_16` es correcto con el `seed`.
15. **Calidad:** sin errores en la consola; la interfaz se ve bien a 360 × 740 y 390 × 844; Lighthouse da 90 o más en Accesibilidad y Buenas prácticas en Inicio.

---

## 19. Riesgos y notas
- **Navegadores dentro de WhatsApp o Telegram:** es el principal riesgo de ingreso, porque los enlaces se compartirán por esas apps (ver 5.1).
- **Fechas:** calcula siempre con la fecha de Lima, no en UTC, para evitar desfases de un día.
- **Cuentas de Google de terceros:** un participante podría ingresar con otra cuenta y crear un segundo usuario. El aviso «Usa siempre la misma cuenta de Google» en P04 y el panel de la investigadora (buscar y mover) lo mitigan; `DOMINIOS_PERMITIDOS` lo evita si la UNAC usa cuentas institucionales de Google.
- **No inventes datos:** si algo no está en este documento ni en los JSON, pregunta.
- **Clave de servicio y `.env`:** van en `.gitignore`.
