-- Reverte 0001_fundacao (PLANO §9.4: rollback = migração down testada).
DROP FUNCTION IF EXISTS auth_buscar_token(bytea, text), auth_resolver_sessao(bytea, timestamptz),
  auth_falha_limpar(bytea), auth_falha_registrar(bytea, timestamptz, uuid),
  auth_falha_bloqueio(bytea, timestamptz), auth_buscar_login(text);
DROP TABLE IF EXISTS outbox, auditoria, chave_idempotencia, falha_login, token_uso_unico, sessao,
  concessao_acesso_individual, vinculo_usuario_projeto, projeto, usuario_perfil, usuario, perfil, tenant;
DROP FUNCTION IF EXISTS auditoria_imutavel();
