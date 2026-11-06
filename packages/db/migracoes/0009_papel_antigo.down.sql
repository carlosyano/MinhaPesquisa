-- Reverte 0009_papel_antigo (PLANO §9.4). As tarefas de localização e o parâmetro da localização
-- saem antes, porque as restrições antigas os recusam; respondente sem CPF impede a volta.
DELETE FROM parametro_configuracao WHERE chave = 'limite_confianca_localizacao';
ALTER TABLE parametro_configuracao
  DROP CONSTRAINT ck_parametro_chave,
  ADD CONSTRAINT ck_parametro_chave CHECK (chave IN (
    'retencao_dias', 'custo_ia_teto', 'limite_confianca', 'grupo_minimo', 'cotacao_usd_brl',
    'retencao_exportacao_dias', 'termo_consentimento'));
ALTER TABLE importacao_formulario DROP COLUMN IF EXISTS papel_antigo;
ALTER TABLE respondente
  DROP CONSTRAINT IF EXISTS ck_respondente_cpf,
  ADD CONSTRAINT ck_respondente_anonimizado CHECK (
    anonimizado OR (data_nascimento IS NOT NULL AND cpf_cifrado IS NOT NULL AND cpf_hash IS NOT NULL));
DELETE FROM tarefa_leitura WHERE grupo = 'localizacao';
ALTER TABLE tarefa_leitura
  DROP COLUMN IF EXISTS pagina_aplicacao_id,
  DROP CONSTRAINT ck_tarefa_grupo,
  ADD CONSTRAINT ck_tarefa_grupo CHECK (grupo IN ('identificacao', 'demais'));
ALTER TABLE pagina_aplicacao
  DROP COLUMN IF EXISTS regioes,
  DROP COLUMN IF EXISTS regiao_assinatura,
  DROP COLUMN IF EXISTS pagina_localizada,
  DROP COLUMN IF EXISTS confianca_localizacao,
  DROP COLUMN IF EXISTS localizada_em;
ALTER TABLE aplicacao DROP COLUMN IF EXISTS origem_qr, DROP COLUMN IF EXISTS paginas_informadas;
ALTER TABLE projeto DROP COLUMN IF EXISTS padrao_data_aplicacao, DROP COLUMN IF EXISTS padrao_local_aplicacao;
ALTER TABLE pergunta DROP COLUMN IF EXISTS nao_consta;
DROP TRIGGER IF EXISTS tg_versao_marca_imutavel ON versao;
DROP FUNCTION IF EXISTS versao_marca_imutavel();
ALTER TABLE versao DROP CONSTRAINT IF EXISTS ck_versao_total_publicada, DROP COLUMN IF EXISTS papel_antigo, DROP COLUMN IF EXISTS total_paginas;
