import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { clavePrivada } from '@/lib/firebase-admin';

// Clave desechable generada en cada corrida (nunca una clave real).
const PEM = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const escapada = PEM.replace(/\n/g, '\\n');

const formatos: Record<string, string> = {
  'saltos de línea reales': PEM,
  '\\n escritos (como en el .json)': escapada,
  'con las comillas de .env.local': `"${escapada}"`,
  'con comillas simples y espacios': ` '${escapada}' `,
  'saltos de Windows': PEM.replace(/\n/g, '\r\n'),
  'todo en una sola línea, sin saltos': PEM.replace(/\n/g, ''),
  'una sola línea con espacios': PEM.replace(/\n/g, ' '),
};

describe('clavePrivada (FIREBASE_PRIVATE_KEY pegada en Vercel o Netlify)', () => {
  for (const [nombre, valor] of Object.entries(formatos)) {
    it(`acepta ${nombre}`, () => {
      const k = clavePrivada(valor);
      expect(k).toBe(PEM);
      expect(() => createPrivateKey(k)).not.toThrow();
    });
  }

  it('sin encabezado PEM la deja como está', () => {
    expect(clavePrivada('abc')).toBe('abc');
  });
});
