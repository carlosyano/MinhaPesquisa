-- Reverte 0011_codigos_formulario_envio (PLANO §9.4).
DROP TRIGGER IF EXISTS tg_formulario_codigo ON formulario;
DROP TRIGGER IF EXISTS tg_projeto_codigo ON projeto;
DROP FUNCTION IF EXISTS mp_codigo_formulario();
DROP FUNCTION IF EXISTS mp_codigo_projeto();
DROP INDEX IF EXISTS ix_aplicacao_formulario;
ALTER TABLE aplicacao DROP CONSTRAINT IF EXISTS fk_aplicacao_formulario, DROP COLUMN IF EXISTS formulario_id;
ALTER TABLE versao DROP CONSTRAINT IF EXISTS ck_versao_numero_qr;
ALTER TABLE formulario DROP CONSTRAINT IF EXISTS uq_formulario_codigo, DROP CONSTRAINT IF EXISTS ck_formulario_codigo, DROP COLUMN IF EXISTS codigo;
ALTER TABLE projeto DROP CONSTRAINT IF EXISTS uq_projeto_codigo, DROP CONSTRAINT IF EXISTS ck_projeto_codigo, DROP COLUMN IF EXISTS codigo;
