-- Reverte 0003_leitura_revisao (PLANO §9.4).
REVOKE UPDATE ON outbox FROM mp_app;
DROP TABLE IF EXISTS tarefa_leitura, consumo_ia, lista_eliminacoes, historico_atributo_respondente, item_resposta CASCADE;
ALTER TABLE aplicacao DROP CONSTRAINT IF EXISTS fk_aplicacao_respondente;
ALTER TABLE aplicacao
  DROP COLUMN IF EXISTS respondente_id, DROP COLUMN IF EXISTS respondente_anterior_id, DROP COLUMN IF EXISTS data_aplicacao,
  DROP COLUMN IF EXISTS local_aplicacao, DROP COLUMN IF EXISTS concluida_em, DROP COLUMN IF EXISTS cpf_hash,
  DROP COLUMN IF EXISTS manter_cadastro, DROP COLUMN IF EXISTS cadastro_versao, DROP COLUMN IF EXISTS motivo_descarte,
  DROP COLUMN IF EXISTS motivo_reabertura, DROP COLUMN IF EXISTS cpf_exibido_em;
DROP TABLE IF EXISTS respondente CASCADE;
ALTER TABLE auditoria DROP COLUMN IF EXISTS seq;
