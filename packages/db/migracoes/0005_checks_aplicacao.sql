-- Checks de aplicação do PLANO §5.3 (ENT-010, DEC-131): aplicação concluída ou sem assinatura tem
-- data e local da aplicação; só a aplicação em identificação pendente, ou descartada antes de ser
-- identificada, fica sem versão.

ALTER TABLE aplicacao
  ADD CONSTRAINT ck_aplicacao_versao CHECK (estado IN ('identificacao_pendente', 'descartada') OR versao_id IS NOT NULL),
  ADD CONSTRAINT ck_aplicacao_dados_conclusao
    CHECK (estado NOT IN ('sem_assinatura', 'concluida') OR (data_aplicacao IS NOT NULL AND local_aplicacao IS NOT NULL));
