/** Utilidades E2E: datos directos en los emuladores (firebase-admin) e ingreso con la ventana del emulador. */
import { type Page, expect } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.METADATA_SERVER_DETECTION ??= 'none';
const PROYECTO = process.env.GCLOUD_PROJECT || 'edugame-ram';

export const db = () => getFirestore(getApps()[0] ?? initializeApp({ projectId: PROYECTO }));

export async function limpiar() {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROYECTO}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROYECTO}/accounts`, { method: 'DELETE' });
}

const hoyLima = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

/** Crea un aula (día 2 del estudio) con su código de unión. Antes reserva el primer admin. */
export async function prepararAula(id: string, brazo: 'experimental' | 'control', codigo: string) {
  const f = db();
  await f.collection('config').doc('sistema').set({ primerAdmin: 'e2e-admin', en: new Date() });
  const inicio = new Date(new Date(`${hoyLima()}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  await f.collection('aulas').doc(id).set({
    nombre: `Aula ${brazo}`,
    facultad: 'Ciencias de la Salud',
    brazo,
    fechaInicio: inicio,
    capacidad: 30,
    inscritos: 0,
    equipos: { E1: 0, E2: 0, E3: 0, E4: 0, E5: 0, E6: 0 },
    codigoUnion: codigo,
    activa: true,
    prueba: true,
    enlaceGrupo: null,
    creadoPor: 'e2e',
    creado: new Date(),
  });
  await f.collection('codigosUnion').doc(codigo).set({ aulaId: id });
}

/** Ingresa con una cuenta nueva de «Google» en la ventana del emulador de Auth. */
export async function entrarConGoogle(page: Page, email: string) {
  await page.goto('/');
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Entrar con Google' }).click()]);
  await popup.getByText('Add new account').click();
  await popup.locator('input').first().fill(email);
  await popup.getByRole('button', { name: /Sign in with Google/i }).click();
  await popup.waitForEvent('close');
}

/** Consentimiento, código de aula y avatar: termina en Inicio. */
export async function completarIngreso(page: Page, codigoAula: string) {
  await expect(page).toHaveURL(/\/consentimiento$/);
  await page.getByLabel('Acepto participar').check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/unirse/);
  await page.getByLabel('Ingresa el código de tu aula').fill(codigoAula.toLowerCase());
  await page.getByRole('button', { name: 'Unirme' }).click();
  await expect(page).toHaveURL(/\/bienvenida-aula$/);
  await page.locator('label:has(input[name=avatar])').first().click();
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/inicio$/);
}
