import { describe, expect, it } from 'vitest';
import { aCsv, celda } from '@/lib/csv';

describe('CSV', () => {
  it('lleva BOM, separador coma y CRLF', () => {
    const t = aCsv(['a', 'b'], [[1, 'x']]);
    expect(t.charCodeAt(0)).toBe(0xfeff);
    expect(t.slice(1)).toBe('a,b\r\n1,x\r\n');
  });

  it('entrecomilla comas, comillas y saltos de línea', () => {
    expect(celda('hola, mundo')).toBe('"hola, mundo"');
    expect(celda('dijo "sí"')).toBe('"dijo ""sí"""');
    expect(celda('a\nb')).toBe('"a\nb"');
  });

  it('vacíos, booleanos y números', () => {
    expect(celda(null)).toBe('');
    expect(celda(undefined)).toBe('');
    expect(celda(true)).toBe('true');
    expect(celda(0)).toBe('0');
    expect(celda(Number.NaN)).toBe('');
  });

  it('neutraliza fórmulas de Excel', () => {
    expect(celda('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(celda('+51 999')).toBe("'+51 999");
    expect(celda('G-7K3PX')).toBe('G-7K3PX');
  });
});
