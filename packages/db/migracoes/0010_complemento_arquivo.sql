-- CHG-018 (IMP-009, DEC-203 (1), PLANO §5.3): texto da opção "Outro" e nome do arquivo enviado.

-- ENT-008: a opção pede um texto ao lado (DEC-197, DEC-202). Imutável depois da publicação pelo
-- gatilho versao_publicada_imutavel, como as demais colunas da opção.
ALTER TABLE opcao
  ADD COLUMN com_complemento boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT uq_opcao_tenant_pergunta UNIQUE (tenant_id, pergunta_id, id);

-- ENT-011: item de complemento, ligado à opção da mesma pergunta e do mesmo tenant (RN-001, RN-009);
-- `revisao_reaberta` marca o a_revisar vindo da reabertura (DEC-203 (10)).
ALTER TABLE item_resposta
  ADD COLUMN opcao_id uuid,
  ADD COLUMN revisao_reaberta boolean NOT NULL DEFAULT false,
  DROP CONSTRAINT uq_item,
  ADD CONSTRAINT fk_item_opcao FOREIGN KEY (tenant_id, pergunta_id, opcao_id) REFERENCES opcao (tenant_id, pergunta_id, id),
  ADD CONSTRAINT ck_item_opcao_linha CHECK (opcao_id IS NULL OR linha_id IS NULL),
  ADD CONSTRAINT ck_item_revisao_reaberta CHECK (NOT revisao_reaberta OR opcao_id IS NOT NULL),
  ADD CONSTRAINT uq_item UNIQUE NULLS NOT DISTINCT (aplicacao_id, pergunta_id, linha_id, opcao_id);

-- ENT-025: nome original do arquivo (DEC-198), dado pessoal; NULL nas páginas de antes desta migração,
-- depois do expurgo e da eliminação (DEC-206). A ordem do envio passa a ser única na aplicação.
ALTER TABLE pagina_aplicacao ADD COLUMN nome_arquivo varchar(255);
DROP INDEX ix_pagina_aplicacao;
CREATE UNIQUE INDEX uq_pagina_ordem_envio ON pagina_aplicacao (aplicacao_id, ordem_envio);
