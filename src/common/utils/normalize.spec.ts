import { normalizeText, sanitizeText } from './normalize';

describe('normalizeText', () => {
  it('normaliza mayúsculas y espacios', () => {
    expect(normalizeText('  Nirvana  ')).toBe('nirvana');
    expect(normalizeText('NIRVANA')).toBe('nirvana');
    expect(normalizeText('nirvana')).toBe('nirvana');
    expect(normalizeText('Asado   en  familia')).toBe('asado en familia');
  });

  it('no elimina acentos', () => {
    expect(normalizeText('Cerámica')).toBe('cerámica');
  });
});

describe('sanitizeText', () => {
  it('recorta longitud', () => {
    expect(sanitizeText('abc', 2)).toBe('ab');
  });
});
