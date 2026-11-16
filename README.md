# EduGame RAM · Guardianes del Antibiótico

Sitio web educativo gamificado para el estudio de la **Universidad Nacional del Callao** sobre uso responsable de antibióticos y resistencia antimicrobiana (RAM).

- Especificación: [`docs/ESPECIFICACION.md`](docs/ESPECIFICACION.md)
- Decisiones tomadas con el equipo (roles, estudio de 1 semana, etc.): [`docs/DECISIONES.md`](docs/DECISIONES.md)
- Textos con tono de juego que ve el grupo control, para revisar: [`docs/REVISION_CONTENIDO.md`](docs/REVISION_CONTENIDO.md)

## Cómo funciona

| Rol | Qué hace | Pantalla |
|---|---|---|
| **Estudiante** | Rol por defecto de toda cuenta nueva. Acepta el consentimiento, se une a su aula con un código de 6 caracteres y hace las actividades | `/inicio` |
| **Promotor** | Gestiona sus aulas: semáforo, equipos, evidencias, encuentros, grupo del aula y CSV | `/panel` |
| **Investigador** | Ve el progreso de todas las aulas y descarga los CSV, sin editar nada | `/seguimiento` |
| **Admin** | La **primera cuenta que ingresa** al sitio. Crea aulas, asigna roles, mueve o retira participantes, configura los enlaces, abre la vista previa y exporta | `/admin` |

- Cada **aula** pertenece a un grupo del estudio: **experimental** (con juego: XP, rangos, racha, insignias, ranking por equipos) o **control** (el mismo contenido, sin ningún elemento de juego).
- El estudio dura **1 semana**: la fecha de inicio del aula es el **día 1**. Todo el contenido se abre ese día, salvo O2, la encuesta de satisfacción y O3, que se abren el **día 7**. Esto se ajusta en [`content/calendario.json`](content/calendario.json).
- Los cuestionarios O1–O3 son formularios externos (Google Forms). La app solo registra «Ya lo respondí» y, en el formulario, el estudiante escribe su **código anónimo** `G-XXXXX`.
- Fuera de la colección `identidades` no se guardan correos ni nombres; en los CSV solo aparece el código anónimo.

## Desarrollo local

Requisitos: Node 20.9 o superior y Java 21 (para los emuladores de Firebase).

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Copia `.env.example` a `.env.local` y completa las variables `NEXT_PUBLIC_FIREBASE_*`. Para trabajar con datos de prueba, pon `USE_FIREBASE_EMULATOR=true`.
3. En una terminal, enciende los emuladores (Auth y Firestore):
   ```bash
   npm run emuladores
   ```
4. En otra terminal, carga los datos de prueba (borra lo que haya en los emuladores):
   ```bash
   npm run seed
   ```
5. Inicia la app:
   ```bash
   npm run dev
   ```
6. Abre http://localhost:3000 y toca **Entrar con Google**. Con los emuladores no se usa Google de verdad: aparece una ventana con las cuentas del seed, listas para elegir:
   - `admin@example.com`, `investigador@example.com`, `promotor1@example.com` y `promotor2@example.com`;
   - `participante1…5@example.com` (aula experimental `EXPE26`) y `participante6…8@example.com` (aula control `CTRL26`).

   Las aulas del seed empezaron hace 5 días (hoy es el día 6). Con **Add new account** creas una cuenta nueva, que entra como estudiante. El encuentro 1 acepta el código de asistencia `FLEMING6`.

## Pruebas

```bash
npm run test        # unidad: reglas del juego, calendario, contenidos, vistas y CSV
npm run test:api    # API contra los emuladores (los enciende y los apaga solo)
npm run test:e2e    # Playwright con tu Chrome instalado, contra los emuladores
npm run typecheck
```

- `test:api` y `test:e2e` necesitan los puertos 8080 y 9099 libres: si tienes los emuladores encendidos, apágalos antes.
- `test:e2e` compila la app y la sirve en el puerto 3200.

## Configurar Firebase (una sola vez)

En https://console.firebase.google.com, proyecto **edugame-ram**:

1. **Authentication → Método de acceso → Google:** habilitar y elegir el correo de asistencia.
2. **Authentication → Configuración → Dominios autorizados:** dejar `localhost` y agregar el dominio de Vercel (por ejemplo `edugame-ram.vercel.app`) y el dominio propio, si existe.
3. **Firestore Database → Crear base de datos:** ubicación **southamerica-east1 (São Paulo)**, modo producción. La ubicación no se puede cambiar después.
4. **Configuración del proyecto → Tus apps → Web:** copiar los valores a las variables `NEXT_PUBLIC_FIREBASE_*`.
5. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.** Se descarga un `.json`. Es secreto: no lo compartas ni lo subas al repositorio. Para tu equipo, cópialo a `.env.local` con:
   ```bash
   node scripts/clave-a-env.mjs "C:\ruta\al\archivo.json"
   ```
6. Publicar las reglas (que bloquean todo acceso directo desde el navegador) y los índices:
   ```bash
   npx firebase login
   ```
   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes --project edugame-ram
   ```

## Desplegar en Vercel

1. Sube el repositorio a GitHub.
2. En https://vercel.com: **Add New → Project →** importa el repositorio. Vercel detecta Next.js solo.
3. En **Settings → Environment Variables**, carga:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | Los de la app web de Firebase |
   | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` | Los del `.json` de la cuenta de servicio |
   | `FIREBASE_PRIVATE_KEY` | El `private_key` del `.json`, completo, con los `\n` tal cual |
   | `NEXT_PUBLIC_URL_SITIO` | La URL pública, por ejemplo `https://edugame-ram.vercel.app` (la usa el QR de los afiches) |
   | `DOMINIOS_PERMITIDOS` | Opcional, por ejemplo `unac.edu.pe`: solo esas cuentas pueden entrar como estudiantes |

   No definas `USE_FIREBASE_EMULATOR` en Vercel.
4. **Deploy.** Las funciones corren en São Paulo (`gru1`, en `vercel.json`), junto a Firestore.
5. Agrega el dominio de Vercel en **Firebase → Authentication → Dominios autorizados** (paso 2 de la sección anterior).
6. Revisa que los términos del plan de Vercel elegido permitan el uso del proyecto.

**Opcional, para navegadores que bloquean la ventana emergente.** La app intenta ingresar con una ventana emergente y, si el navegador la bloquea, usa una redirección. En los navegadores actuales, la redirección solo funciona si el ingreso se sirve desde el mismo dominio del sitio. La app ya trae el reenvío `/__/auth/*` hacia Firebase. Para activarlo:
1. Pon `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = el dominio del sitio (por ejemplo `edugame-ram.vercel.app`).
2. En Google Cloud Console → **APIs y servicios → Credenciales →** cliente OAuth web del proyecto, agrega `https://edugame-ram.vercel.app/__/auth/handler` a los URI de redirección autorizados.

## Primeros pasos con el sitio publicado

1. **Entra tú primero** con tu cuenta de Google: la primera cuenta queda como **admin**. Hazlo antes de compartir el enlace.
2. En **/admin → Configuración**, pega los enlaces de O1, O2, satisfacción y O3. Para prellenar el código, usa el enlace prellenado de Google Forms con `{codigo}`.
3. En **/admin → Aulas**, crea las aulas: nombre, facultad, grupo (experimental o control), fecha de inicio (día 1) y capacidad. Para probar, marca «Aula de prueba».
4. El personal (promotores e investigadores) entra con Google y queda como estudiante. En **Usuarios y roles**, búscalo por su correo (o su código G-XXXXX), cámbiale el rol y, si es promotor, elige sus aulas. **Mostrar población** lista a todos por aula con su rol, pero lee un registro por usuario: úsalo solo cuando lo necesites.
5. Cada promotor entra a **/panel**, imprime el **afiche** de su aula (con QR) o comparte el código, define los códigos de asistencia de los encuentros y el enlace del grupo del aula.
6. Los estudiantes abren el enlace en **Chrome o Safari** (no en el navegador de WhatsApp), entran con Google, aceptan el consentimiento y escriben el código del aula.
7. Para revisar lo que ve cada grupo sin crear cuentas: **/admin → Vista previa** (no guarda nada).

## Costos

Firebase Auth y Firestore deberían alcanzar en el plan gratuito Spark para unos 400 usuarios: Inicio usa 2 o 3 lecturas, porque el progreso resumido está en el documento del usuario. Exportar todos los eventos de todas las aulas lee un documento por evento: conviene exportar por aula. Verifica las cuotas vigentes de Firebase y de Vercel antes del estudio.

## Estructura

```
app/            pantallas (participante, /panel, /seguimiento, /admin, /vista-previa) y api/**/route.ts
components/     interfaz (actividades, panel, admin, sesión)
lib/            juego.ts (reglas puras), contenido.ts (carga y validación), servicios/ (lógica con Firestore)
content/        contenidos del kit (sin cambios) y calendario.json (decisión 7)
scripts/        seed, revisión de contenido y clave de servicio
tests/          unit/ y api/ (Vitest) · e2e/ (Playwright)
```
