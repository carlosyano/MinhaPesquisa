// Registro da imagem pelos 4 marcadores fiduciais dos cantos (DEC-048), com imagens sintéticas.
// Scanner de mesa deixa uma linha pontilhada escura na borda: ela não pode invalidar o marcador.

import { describe, expect, it } from 'vitest';
import { marcadoresPresentes } from '../../apps/api/src/infra/imagens.js';

const L = 1273;
const A = 1800;

function pagina(): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(L * A * 4).fill(255);
  const lado = 44;
  for (const [x0, y0] of [
    [40, 40],
    [L - 40 - lado, 40],
    [40, A - 80 - lado],
    [L - 40 - lado, A - 80 - lado],
  ]) {
    pintar(rgba, x0, y0, lado, lado);
  }
  return rgba;
}

function pintar(rgba: Uint8ClampedArray, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * L + x) * 4;
      rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
    }
  }
}

describe('marcadoresPresentes (DEC-048)', () => {
  it('quatro marcadores → registro ok', () => {
    expect(marcadoresPresentes(pagina(), L, A)).toBe(true);
  });

  it('linha pontilhada do scanner na borda inferior não invalida o marcador', () => {
    const rgba = pagina();
    for (let x = 0; x < L; x += 6) pintar(rgba, x, A - 8, 3, 2);
    expect(marcadoresPresentes(rgba, L, A)).toBe(true);
  });

  it('canto sem marcador → registro falha', () => {
    const rgba = pagina();
    for (let y = A - 144; y < A; y++) for (let x = 0; x < 101; x++) rgba.fill(255, (y * L + x) * 4, (y * L + x) * 4 + 3);
    expect(marcadoresPresentes(rgba, L, A)).toBe(false);
  });

  it('só a linha pontilhada no canto (sem marcador) → registro falha', () => {
    const rgba = pagina();
    for (let y = A - 144; y < A; y++) for (let x = 0; x < 101; x++) rgba.fill(255, (y * L + x) * 4, (y * L + x) * 4 + 3);
    for (let x = 0; x < L; x += 6) pintar(rgba, x, A - 8, 3, 2);
    expect(marcadoresPresentes(rgba, L, A)).toBe(false);
  });
});
