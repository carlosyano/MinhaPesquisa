// Autoteste do apoio aos testes (não depende da API): garante que o gerador TOTP e a
// leitura do catálogo de erros estão certos antes de usá-los nos testes vermelhos.

import { describe, expect, it } from 'vitest';
import { CATALOGO } from './catalogo.js';
import { codigoErrado, codigoTotp, segredoDaUri } from './totp.js';

// Segredo ASCII "12345678901234567890" do RFC 6238, apêndice B, em base32.
const SEGREDO_RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('apoio aos testes', () => {
  // @trace DEC-050
  it('TOTP confere com os vetores do RFC 6238 (SHA-1, 6 dígitos finais)', () => {
    expect(codigoTotp(SEGREDO_RFC, new Date(59_000))).toBe('287082');
    expect(codigoTotp(SEGREDO_RFC, new Date(1_111_111_109_000))).toBe('081804');
    expect(codigoTotp(SEGREDO_RFC, new Date(20_000_000_000_000))).toBe('353130');
  });

  // @trace DEC-050
  it('código errado difere do válido na janela e a URI otpauth devolve o segredo', () => {
    const agora = new Date(1_111_111_109_000);
    expect(codigoErrado(SEGREDO_RFC, agora)).not.toBe(codigoTotp(SEGREDO_RFC, agora));
    expect(segredoDaUri(`otpauth://totp/MinhaPesquisa:x?secret=${SEGREDO_RFC}&issuer=MinhaPesquisa`)).toBe(SEGREDO_RFC);
  });

  // @trace Bloco P P.6
  it('catálogo de erros lido do CSV gerado da REQ', () => {
    expect(CATALOGO.get('ERR-013')).toEqual({ http_status: 401, mensagem: 'Credenciais inválidas.' });
    expect(CATALOGO.get('ERR-014')?.http_status).toBe(429);
    expect(CATALOGO.has('ERR-005')).toBe(false); // descontinuado
  });
});
