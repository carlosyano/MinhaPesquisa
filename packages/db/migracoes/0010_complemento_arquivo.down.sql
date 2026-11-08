-- Reverte 0010_complemento_arquivo (PLANO §9.4). Os itens de complemento saem antes, porque a
-- restrição única antiga os recusa.
DROP INDEX IF EXISTS uq_pagina_ordem_envio;
CREATE INDEX IF NOT EXISTS ix_pagina_aplicacao ON pagina_aplicacao (aplicacao_id, ordem_envio);
ALTER TABLE pagina_aplicacao DROP COLUMN IF EXISTS nome_arquivo;
DELETE FROM item_resposta WHERE opcao_id IS NOT NULL;
ALTER TABLE item_resposta
  DROP CONSTRAINT uq_item,
  DROP CONSTRAINT IF EXISTS ck_item_revisao_reaberta,
  DROP CONSTRAINT IF EXISTS ck_item_opcao_linha,
  DROP CONSTRAINT IF EXISTS fk_item_opcao,
  DROP COLUMN IF EXISTS revisao_reaberta,
  DROP COLUMN IF EXISTS opcao_id,
  ADD CONSTRAINT uq_item UNIQUE NULLS NOT DISTINCT (aplicacao_id, pergunta_id, linha_id);
ALTER TABLE opcao DROP CONSTRAINT IF EXISTS uq_opcao_tenant_pergunta, DROP COLUMN IF EXISTS com_complemento;
