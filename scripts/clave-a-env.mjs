/**
 * Copia la clave de la cuenta de servicio de Firebase (archivo .json) a .env.local
 * y desactiva los emuladores. No muestra la clave en pantalla.
 *
 *   node scripts/clave-a-env.mjs "C:\Users\...\Downloads\edugame-ram-firebase-adminsdk-xxxx.json"
 *
 * Después puedes borrar el .json (o guardarlo fuera del proyecto). Nunca lo subas al repositorio.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const ruta = process.argv[2];
if (!ruta || !existsSync(ruta)) {
  console.error('Uso: node scripts/clave-a-env.mjs <ruta al archivo .json de la cuenta de servicio>');
  process.exit(1);
}

let clave;
try {
  clave = JSON.parse(readFileSync(ruta, 'utf8'));
} catch {
  console.error('El archivo no es un JSON válido.');
  process.exit(1);
}
if (clave.type !== 'service_account' || !clave.project_id || !clave.client_email || !clave.private_key) {
  console.error('El archivo no parece una clave de cuenta de servicio de Firebase.');
  process.exit(1);
}

const valores = {
  FIREBASE_PROJECT_ID: clave.project_id,
  FIREBASE_CLIENT_EMAIL: clave.client_email,
  FIREBASE_PRIVATE_KEY: `"${clave.private_key.replace(/\n/g, '\\n')}"`,
  USE_FIREBASE_EMULATOR: 'false',
};

const archivo = '.env.local';
let lineas = existsSync(archivo) ? readFileSync(archivo, 'utf8').split(/\r?\n/) : [];
for (const [k, v] of Object.entries(valores)) {
  const i = lineas.findIndex((l) => l.startsWith(`${k}=`));
  if (i >= 0) lineas[i] = `${k}=${v}`;
  else lineas.push(`${k}=${v}`);
}
writeFileSync(archivo, lineas.join('\n').replace(/\n*$/, '\n'));

const publico = lineas.find((l) => l.startsWith('NEXT_PUBLIC_FIREBASE_PROJECT_ID='))?.split('=')[1];
console.log(`Listo: .env.local usa la cuenta de servicio del proyecto «${clave.project_id}» y los emuladores quedaron desactivados.`);
if (publico && publico !== clave.project_id) {
  console.warn(`Atención: NEXT_PUBLIC_FIREBASE_PROJECT_ID es «${publico}», distinto del de la clave.`);
}
console.log('Reinicia «npm run dev» para que tome los cambios.');
