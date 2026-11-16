import { describe, expect, it } from 'vitest';
import { HORA_MS, limiteAgotado, siguientePaso, sumarFallo } from '@/lib/juego';
import { analizarNavegador, enlaceIntentChrome } from '@/lib/navegador';

describe('siguiente paso (sección 5.1 y decisión 6)', () => {
  const base = { rol: 'estudiante' as const, consentimiento: null, aulaId: null, avatar: null };

  it('el estudiante pasa por consentimiento → aula → avatar → inicio', () => {
    expect(siguientePaso(base)).toBe('/consentimiento');
    expect(siguientePaso({ ...base, consentimiento: { version: '2.0' } })).toBe('/unirse');
    expect(siguientePaso({ ...base, consentimiento: { version: '2.0' }, aulaId: 'a1' })).toBe('/bienvenida-aula');
    expect(siguientePaso({ ...base, consentimiento: { version: '2.0' }, aulaId: 'a1', avatar: '🦸' })).toBe('/inicio');
  });

  it('el personal va directo a su panel, sin consentimiento ni aula', () => {
    expect(siguientePaso({ ...base, rol: 'admin' })).toBe('/admin');
    expect(siguientePaso({ ...base, rol: 'investigador' })).toBe('/seguimiento');
    expect(siguientePaso({ ...base, rol: 'promotor' })).toBe('/panel');
  });
});

describe('límite de intentos', () => {
  it('bloquea al llegar a 10 fallos en una hora', () => {
    let v: ReturnType<typeof sumarFallo> | undefined;
    const t0 = 1_000_000;
    for (let i = 0; i < 9; i++) v = sumarFallo(v, t0 + i * 1000);
    expect(v!.intentos).toBe(9);
    expect(limiteAgotado(v, t0 + 10_000)).toBe(false);
    v = sumarFallo(v, t0 + 10_000);
    expect(limiteAgotado(v, t0 + 11_000)).toBe(true);
  });

  it('se libera cuando vence la hora', () => {
    const v = { desde: 0, intentos: 10 };
    expect(limiteAgotado(v, HORA_MS - 1)).toBe(true);
    expect(limiteAgotado(v, HORA_MS)).toBe(false);
    expect(sumarFallo(v, HORA_MS)).toEqual({ desde: HORA_MS, intentos: 1 });
  });

  it('sin fallos no hay bloqueo', () => {
    expect(limiteAgotado(undefined, 0)).toBe(false);
  });
});

describe('navegadores integrados (criterio 2)', () => {
  const UA = {
    whatsappAndroid:
      'Mozilla/5.0 (Linux; Android 13; SM-A135M Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 WhatsApp/2.24.1.6',
    whatsappIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/24.1.79',
    instagram:
      'Mozilla/5.0 (Linux; Android 12; moto g(30) Build/S0RRS32.38-80-4; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 Mobile Safari/537.36 Instagram 312.1.0.34.111 Android',
    facebookIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone12,1;FBMD/iPhone;FBSN/iOS;FBSV/16.6]',
    telegram:
      'Mozilla/5.0 (Linux; Android 11; Redmi Note 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36 Telegram-Android/10.2.3',
    webviewIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    chromeAndroid:
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    safariIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    chromeIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
    escritorio:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  it('detecta WhatsApp, Instagram, Facebook, Telegram y WebView', () => {
    expect(analizarNavegador(UA.whatsappAndroid)).toEqual({ integrado: true, app: 'WhatsApp', plataforma: 'android' });
    expect(analizarNavegador(UA.whatsappIos)).toEqual({ integrado: true, app: 'WhatsApp', plataforma: 'ios' });
    expect(analizarNavegador(UA.instagram).app).toBe('Instagram');
    expect(analizarNavegador(UA.facebookIos).app).toBe('Facebook');
    expect(analizarNavegador(UA.telegram).app).toBe('Telegram');
    expect(analizarNavegador(UA.webviewIos)).toEqual({ integrado: true, app: 'WebView', plataforma: 'ios' });
  });

  it('no bloquea Chrome, Safari ni el escritorio', () => {
    for (const ua of [UA.chromeAndroid, UA.safariIos, UA.chromeIos, UA.escritorio]) {
      expect(analizarNavegador(ua).integrado, ua).toBe(false);
    }
  });

  it('arma el enlace para abrir en Chrome desde Android', () => {
    expect(enlaceIntentChrome('https://edugame-ram.vercel.app/unirse?codigo=K7Q2PX')).toBe(
      'intent://edugame-ram.vercel.app/unirse?codigo=K7Q2PX#Intent;scheme=https;package=com.android.chrome;end',
    );
  });
});
