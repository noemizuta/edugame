# EduGame RAM · Guardianes del Antibiótico

Sitio web educativo gamificado para un **estudio de investigación** de la Universidad Nacional del Callao (Perú) sobre uso responsable de antibióticos y resistencia antimicrobiana (RAM).

**Especificación completa:** `docs/ESPECIFICACION.md` (fuente de verdad). **Decisiones y plan acordados:** `docs/DECISIONES.md` (léelo antes de continuar). Contenidos: `content/*.json` (copiados desde `contenido/` del kit).

## Stack
- Next.js (App Router), TypeScript estricto y Tailwind.
- Firebase Authentication con **Google** (solo en el cliente).
- **Cloud Firestore solo desde el servidor** (firebase-admin en Route Handlers). Reglas de Firestore *deny-all*.
- zod para validar contenidos y entradas de la API.
- Vitest (unitarias y API contra el emulador) y Playwright (E2E contra el emulador).
- Despliegue en Vercel (región `gru1`) o Netlify.

## Reglas que no se rompen
1. El grupo **control** ve los mismos contenidos **sin ningún elemento de juego**.
2. El contenido se desbloquea **por semana del aula** (fecha de Lima), igual para todos.
3. **Cuenta el primer intento**; la práctica no da puntos. Nunca hay puntos negativos.
4. **Ranking solo por equipos** (promedio de XP), nunca individual.
5. Las **respuestas correctas y la retroalimentación nunca se envían al navegador** antes de responder: valida en el servidor.
6. **Anonimato:** fuera de `identidades`, solo el código `G-XXXXX`; nunca correos ni nombres en la interfaz ni en los CSV.
7. Consentimiento antes de unirse a un aula. Máximo 30 por aula, equipos de 5 en el experimental.
8. **Roles** (decisión 6 de `docs/DECISIONES.md`): `estudiante` (por defecto), `promotor`, `investigador` (solo observa, no resuelve actividades) y `admin` (la primera cuenta que ingresa; asigna los roles).
9. **No inventes ni modifiques contenido científico.** Si algo falta o parece un error, pregunta.

## Convenciones
- Todo texto de interfaz en **español del Perú**. El código y los nombres de variables pueden estar en español o en inglés, pero de forma consistente.
- La lógica pura del juego va en `lib/juego.ts`, sin acceso a datos, y con pruebas.
- Los ID de actividad no llevan puntos (se usan como ID de documento).
- Nunca subas `.env*` ni claves de servicio.

## Comandos
- `npm run dev` — Next en http://localhost:3000 (con `USE_FIREBASE_EMULATOR=true` en `.env.local`)
- `npm run emuladores` — `firebase emulators:start --only auth,firestore` (requiere Java; UI en http://127.0.0.1:4000)
- `npm run seed` — borra los emuladores y carga los datos de prueba (solo corre contra emuladores locales)
- `npm run test` — Vitest de unidad (`tests/unit`)
- `npm run test:api` — Vitest de la API dentro de `firebase emulators:exec` (`tests/api`)
- `npm run test:e2e` — Playwright (`e2e/`)
- `npm run revision-contenido` — genera `docs/REVISION_CONTENIDO.md` (tono de juego que ve el control)
- `npm run typecheck` · `npm run build`
