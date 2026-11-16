/**
 * Detección de navegadores integrados (in-app), donde Google bloquea el
 * ingreso con «disallowed_useragent» (sección 5.1). Lógica pura.
 */

export type Plataforma = 'android' | 'ios' | 'otra';

export interface InfoNavegador {
  integrado: boolean;
  /** App detectada, si se reconoce. */
  app: 'WhatsApp' | 'Telegram' | 'Instagram' | 'Facebook' | 'Messenger' | 'TikTok' | 'LINE' | 'WebView' | null;
  plataforma: Plataforma;
}

const APPS: [RegExp, NonNullable<InfoNavegador['app']>][] = [
  [/WhatsApp/i, 'WhatsApp'],
  [/Telegram/i, 'Telegram'],
  [/Instagram/i, 'Instagram'],
  [/FBAN\/Messenger|FB_IAB\/MESSENGER|MessengerForiOS/i, 'Messenger'],
  [/FBAN|FBAV|FB_IAB|FBIOS|\[FB/i, 'Facebook'],
  [/musical_ly|BytedanceWebview|TikTok/i, 'TikTok'],
  [/\bLine\//, 'LINE'],
];

export function analizarNavegador(ua: string): InfoNavegador {
  const plataforma: Plataforma = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : 'otra';
  for (const [re, app] of APPS) if (re.test(ua)) return { integrado: true, app, plataforma };

  // WebView genérico de Android: «; wv)» en el user agent.
  if (plataforma === 'android' && /;\s*wv\)/.test(ua)) return { integrado: true, app: 'WebView', plataforma };

  // WKWebView de iOS: AppleWebKit sin el token «Safari/» (Chrome y Firefox de iOS sí lo llevan).
  if (plataforma === 'ios' && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)) {
    return { integrado: true, app: 'WebView', plataforma };
  }
  return { integrado: false, app: null, plataforma };
}

/** Enlace que abre la misma URL en Chrome desde un WebView de Android. */
export function enlaceIntentChrome(url: string): string {
  const u = new URL(url);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;end`;
}
