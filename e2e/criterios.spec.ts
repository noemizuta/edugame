import { expect, test } from '@playwright/test';
import { completarIngreso, db, entrarConGoogle, limpiar, prepararAula } from './ayuda';

/** Errores de consola inesperados (los 4xx esperados de la API se registran como «Failed to load resource»). */
function vigilarConsola(page: import('@playwright/test').Page) {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(String(e)));
  return errores;
}

test.beforeEach(async () => {
  await limpiar();
  await prepararAula('aula-exp', 'experimental', 'EXPE26');
  await prepararAula('aula-ctl', 'control', 'CTRL26');
});

test('criterio 1: primer ingreso → consentimiento → código → avatar → Inicio, sin correos fuera de identidades', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConGoogle(page, 'ana.e2e@example.com');
  await completarIngreso(page, 'EXPE26');
  await expect(page.getByRole('heading', { name: 'Guardianes del Antibiótico' })).toBeVisible();
  await expect(page.getByText('Día 2 de 7')).toBeVisible();
  await expect(page.getByRole('progressbar')).toBeVisible();

  const usuarios = (await db().collection('usuarios').get()).docs.map((d) => d.data());
  const est = usuarios.find((u) => u.rol === 'estudiante')!;
  expect(est.codigo).toMatch(/^G-[A-Z2-9]{5}$/);
  for (const c of ['usuarios', 'eventos', 'aulas', 'codigosParticipante']) {
    for (const d of (await db().collection(c).get()).docs) expect(JSON.stringify(d.data()), `${c}/${d.id}`).not.toContain('@');
  }
  expect(errores).toEqual([]);
});

test.describe('criterio 2: navegador integrado', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-A135M Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 WhatsApp/2.24.1.6',
  });
  test('con el user agent de WhatsApp aparece el aviso y no se intenta ingresar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Para ingresar con Google, abre este enlace en Chrome o Safari')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar con Google' })).toHaveCount(0);
  });
});

test('criterio 9: el control no ve elementos de juego y /ranking vuelve a Inicio', async ({ page }) => {
  await entrarConGoogle(page, 'luis.e2e@example.com');
  await completarIngreso(page, 'CTRL26');
  await expect(page.getByRole('heading', { name: 'Aprende sobre antibióticos' })).toBeVisible();
  await expect(page.getByText('Siguiente tema')).toBeVisible();
  const texto = await page.locator('main').innerText();
  expect(texto).not.toMatch(/\bXP\b|Racha|Equipo|Misión 1|Caso Callao 2050|Misiones de campo/);
  await expect(page.getByRole('link', { name: 'Ranking' })).toHaveCount(0);
  await page.goto('/ranking');
  await expect(page).toHaveURL(/\/inicio$/);
});

test.describe('criterio 15: celular de 360 × 740', () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test('Inicio y una actividad se ven sin desplazamiento horizontal', async ({ page }) => {
    await entrarConGoogle(page, 'rosa.e2e@example.com');
    await completarIngreso(page, 'EXPE26');
    const ancho = () => page.evaluate(() => document.documentElement.scrollWidth);
    expect(await ancho()).toBeLessThanOrEqual(360);
    await page.goto('/actividad/caso-botica-1');
    await expect(page.getByText('¿Qué debería hacer?')).toBeVisible();
    expect(await ancho()).toBeLessThanOrEqual(360);
  });
});
