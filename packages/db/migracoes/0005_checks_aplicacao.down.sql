-- Reverte 0005_checks_aplicacao (PLANO §9.4).
ALTER TABLE aplicacao DROP CONSTRAINT IF EXISTS ck_aplicacao_dados_conclusao, DROP CONSTRAINT IF EXISTS ck_aplicacao_versao;
