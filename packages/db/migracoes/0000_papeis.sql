-- Papéis do banco (DEC-046, DEC-090). Roda uma vez por banco, como superusuário (DBA),
-- antes das migrações. As senhas de login de mp_app e mp_manutencao são definidas fora do
-- repositório (gerenciador de segredos); aqui os papéis nascem sem senha.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mp_owner') THEN
    CREATE ROLE mp_owner NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mp_auth') THEN
    CREATE ROLE mp_auth NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mp_app') THEN
    CREATE ROLE mp_app LOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mp_manutencao') THEN
    CREATE ROLE mp_manutencao LOGIN BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE, CREATE ON SCHEMA public TO mp_owner;
-- ALTER FUNCTION ... OWNER exige que o novo dono possa criar no schema; mp_auth é NOLOGIN.
GRANT CREATE ON SCHEMA public TO mp_auth;
GRANT USAGE ON SCHEMA public TO mp_app, mp_manutencao, mp_auth;
-- mp_owner cria as funções auth_* e as entrega a mp_auth (ALTER ... OWNER exige pertencer
-- ao papel). Atributos como BYPASSRLS não são herdados por pertencimento.
GRANT mp_auth TO mp_owner;
