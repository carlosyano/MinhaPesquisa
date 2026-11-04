// Autoteste do apoio aos testes (não depende da API): garante que a leitura do catálogo de
// erros está certa antes de usá-la nos testes vermelhos.

import { describe, expect, it } from 'vitest';
import { CATALOGO } from './catalogo.js';

describe('apoio aos testes', () => {
  // @trace Bloco P P.6
  it('catálogo de erros lido do CSV gerado da REQ', () => {
    expect(CATALOGO.get('ERR-013')).toEqual({ http_status: 401, mensagem: 'Credenciais inválidas.' });
    expect(CATALOGO.get('ERR-014')?.http_status).toBe(429);
    expect(CATALOGO.has('ERR-005')).toBe(false); // descontinuado
  });

  // @trace Bloco P P.6, DEC-108, DEC-109
  it('os erros de MFA, convite, concessão, k-anonimato e reserva saem do catálogo (REQ v2.1)', () => {
    for (const id of ['ERR-008', 'ERR-011', 'ERR-012', 'ERR-023', 'ERR-024', 'ERR-043']) {
      expect(CATALOGO.has(id), id).toBe(false);
    }
  });
});
