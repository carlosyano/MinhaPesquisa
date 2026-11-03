-- Reverte 0002_projetos_formularios_upload (PLANO §9.4).
DROP TABLE IF EXISTS pagina_aplicacao, aplicacao, regra_salto, linha_matriz, opcao, pergunta, versao, formulario,
  historico_status_projeto, parametro_configuracao;
DROP FUNCTION IF EXISTS versao_publicada_imutavel();
ALTER TABLE projeto DROP COLUMN IF EXISTS versao;
