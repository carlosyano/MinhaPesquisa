-- IMP-001: tenants, usuários, perfis, projetos (mínimo), vínculos, concessões, sessões,
-- tokens, falhas de login, idempotência, auditoria e outbox. Executada como mp_owner.
-- Isolamento: FK composta (id, tenant_id) + RLS com FORCE e app.tenant_id (DEC-040, DEC-046).
-- Instantes vêm sempre da aplicação (relógio injetável, PLANO §10.2), nunca de now().

CREATE TABLE tenant (
  id          uuid PRIMARY KEY,
  nome        varchar(200) NOT NULL,
  slug        varchar(50)  NOT NULL CONSTRAINT uq_tenant_slug UNIQUE CONSTRAINT ck_tenant_slug CHECK (slug ~ '^[a-z0-9-]+$'),
  criado_em   timestamptz  NOT NULL,
  ativo       boolean      NOT NULL DEFAULT true
);

CREATE TABLE perfil (
  id         uuid PRIMARY KEY,
  tenant_id  uuid NOT NULL CONSTRAINT fk_perfil_tenant REFERENCES tenant (id),
  codigo     varchar(50)  NOT NULL CONSTRAINT ck_perfil_codigo CHECK (codigo IN ('admin_tenant', 'digitalizador', 'analista', 'analista_individual')),
  nome       varchar(100) NOT NULL,
  CONSTRAINT uq_perfil_tenant_codigo UNIQUE (tenant_id, codigo),
  CONSTRAINT uq_perfil_id_tenant UNIQUE (id, tenant_id)
);

CREATE TABLE usuario (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL CONSTRAINT fk_usuario_tenant REFERENCES tenant (id),
  email            varchar(255) NOT NULL CONSTRAINT uq_usuario_email UNIQUE,
  nome             varchar(200) NOT NULL,
  senha_hash       varchar(255) NOT NULL,
  mfa_secret       varchar(255),
  mfa_ativo        boolean NOT NULL DEFAULT false,
  mfa_ultimo_passo bigint,
  ultimo_login     timestamptz,
  situacao         varchar(20) NOT NULL DEFAULT 'pendente_convite'
                   CONSTRAINT ck_usuario_situacao CHECK (situacao IN ('pendente_convite', 'ativo', 'inativo')),
  todos_projetos   boolean NOT NULL DEFAULT true,
  criado_em        timestamptz NOT NULL,
  versao           integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_usuario_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT ck_usuario_email_normalizado CHECK (email = lower(email))
);

CREATE TABLE usuario_perfil (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  usuario_id  uuid NOT NULL,
  perfil_id   uuid NOT NULL,
  criado_em   timestamptz NOT NULL,
  criado_por  uuid,
  CONSTRAINT fk_usuario_perfil_usuario FOREIGN KEY (usuario_id, tenant_id) REFERENCES usuario (id, tenant_id),
  CONSTRAINT fk_usuario_perfil_perfil FOREIGN KEY (perfil_id, tenant_id) REFERENCES perfil (id, tenant_id),
  CONSTRAINT uq_usuario_perfil UNIQUE (tenant_id, usuario_id, perfil_id)
);

-- Projeto mínimo do IMP-001; os demais campos e operações chegam no IMP-002 (RF-003).
CREATE TABLE projeto (
  id         uuid PRIMARY KEY,
  tenant_id  uuid NOT NULL CONSTRAINT fk_projeto_tenant REFERENCES tenant (id),
  nome       varchar(200) NOT NULL,
  descricao  text CONSTRAINT ck_projeto_descricao CHECK (length(descricao) <= 5000),
  status     varchar(20) NOT NULL DEFAULT 'ativo' CONSTRAINT ck_projeto_status CHECK (status IN ('ativo', 'arquivado')),
  criado_em  timestamptz NOT NULL,
  CONSTRAINT uq_projeto_id_tenant UNIQUE (id, tenant_id)
);

CREATE TABLE vinculo_usuario_projeto (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  usuario_id  uuid NOT NULL,
  projeto_id  uuid NOT NULL,
  criado_em   timestamptz NOT NULL,
  criado_por  uuid,
  CONSTRAINT fk_vinculo_usuario FOREIGN KEY (usuario_id, tenant_id) REFERENCES usuario (id, tenant_id),
  CONSTRAINT fk_vinculo_projeto FOREIGN KEY (projeto_id, tenant_id) REFERENCES projeto (id, tenant_id),
  CONSTRAINT uq_vinculo_usuario_projeto UNIQUE (tenant_id, usuario_id, projeto_id)
);

CREATE TABLE concessao_acesso_individual (
  id            uuid PRIMARY KEY,
  tenant_id     uuid NOT NULL,
  usuario_id    uuid NOT NULL,
  projeto_id    uuid NOT NULL,
  justificativa text NOT NULL CONSTRAINT ck_concessao_justificativa CHECK (length(justificativa) BETWEEN 10 AND 1000),
  concedido_em  timestamptz NOT NULL,
  valido_ate    timestamptz NOT NULL,
  revogado_em   timestamptz,
  revogado_por  uuid,
  ativo         boolean NOT NULL DEFAULT true,
  criado_por    uuid NOT NULL,
  CONSTRAINT fk_concessao_usuario FOREIGN KEY (usuario_id, tenant_id) REFERENCES usuario (id, tenant_id),
  CONSTRAINT fk_concessao_projeto FOREIGN KEY (projeto_id, tenant_id) REFERENCES projeto (id, tenant_id),
  CONSTRAINT uq_concessao_id_tenant UNIQUE (id, tenant_id)
);
CREATE UNIQUE INDEX uq_concessao_ativa ON concessao_acesso_individual (tenant_id, usuario_id, projeto_id) WHERE ativo;

-- Sessão plena e pré-sessão (DEC-044, DEC-050). Só o hash do segredo do cookie é guardado.
CREATE TABLE sessao (
  id                  uuid PRIMARY KEY,
  tenant_id           uuid NOT NULL,
  usuario_id          uuid NOT NULL,
  tipo                varchar(20) NOT NULL CONSTRAINT ck_sessao_tipo CHECK (tipo IN ('pre_sessao', 'plena')),
  etapa               varchar(20) CONSTRAINT ck_sessao_etapa CHECK (etapa IN ('mfa_verificacao', 'mfa_cadastro')),
  token_id            uuid,
  segredo_hash        bytea NOT NULL CONSTRAINT uq_sessao_segredo UNIQUE,
  criada_em           timestamptz NOT NULL,
  ultima_atividade_em timestamptz NOT NULL,
  expira_absoluta_em  timestamptz NOT NULL,
  revogada_em         timestamptz,
  motivo_revogacao    varchar(30),
  ip                  inet,
  CONSTRAINT fk_sessao_usuario FOREIGN KEY (usuario_id, tenant_id) REFERENCES usuario (id, tenant_id),
  CONSTRAINT ck_sessao_etapa_tipo CHECK ((tipo = 'pre_sessao') = (etapa IS NOT NULL))
);
CREATE INDEX ix_sessao_usuario ON sessao (tenant_id, usuario_id) WHERE revogada_em IS NULL;

CREATE TABLE token_uso_unico (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  usuario_id  uuid NOT NULL,
  tipo        varchar(20) NOT NULL CONSTRAINT ck_token_tipo CHECK (tipo IN ('convite', 'recuperacao_senha', 'reset_mfa')),
  token_hash  bytea NOT NULL CONSTRAINT uq_token_hash UNIQUE,
  expira_em   timestamptz NOT NULL,
  usado_em    timestamptz,
  criado_em   timestamptz NOT NULL,
  CONSTRAINT fk_token_usuario FOREIGN KEY (usuario_id, tenant_id) REFERENCES usuario (id, tenant_id)
);

-- Sem tenant_id: o login acontece antes de conhecer o tenant (ENT-030, DEC-054).
CREATE TABLE falha_login (
  id             uuid PRIMARY KEY,
  email_hmac     bytea NOT NULL CONSTRAINT uq_falha_login_email UNIQUE,
  tentativas     integer NOT NULL DEFAULT 0 CONSTRAINT ck_falha_tentativas CHECK (tentativas BETWEEN 0 AND 100),
  janela_inicio  timestamptz NOT NULL,
  bloqueado_ate  timestamptz
);

CREATE TABLE chave_idempotencia (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL,
  usuario_id       uuid NOT NULL,
  chave            varchar(64) NOT NULL,
  operacao         varchar(100) NOT NULL,
  hash_requisicao  bytea NOT NULL,
  resposta         jsonb NOT NULL,
  criado_em        timestamptz NOT NULL,
  expira_em        timestamptz NOT NULL,
  CONSTRAINT fk_idempotencia_usuario FOREIGN KEY (usuario_id, tenant_id) REFERENCES usuario (id, tenant_id),
  CONSTRAINT uq_chave_idempotencia UNIQUE (usuario_id, operacao, chave)
);

-- Auditoria imutável: só referências, nunca valores pessoais (RN-027, PLANO §5.2).
CREATE TABLE auditoria (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL CONSTRAINT fk_auditoria_tenant REFERENCES tenant (id),
  usuario_id   uuid,
  acao         varchar(100) NOT NULL,
  entidade     varchar(100) NOT NULL,
  registro_id  uuid,
  campo        varchar(100),
  ip           inet,
  canal        varchar(10) CONSTRAINT ck_auditoria_canal CHECK (canal IN ('web', 'api', 'script')),
  detalhes     jsonb,
  criado_em    timestamptz NOT NULL
);
CREATE INDEX ix_auditoria_tenant_criado ON auditoria (tenant_id, criado_em);

CREATE FUNCTION auditoria_imutavel() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'auditoria é imutável';
END
$$;
CREATE TRIGGER tg_auditoria_imutavel BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_imutavel();

-- Outbox transacional: só IDs no payload (PLANO §4.7, DEC-088).
CREATE TABLE outbox (
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL CONSTRAINT fk_outbox_tenant REFERENCES tenant (id),
  tipo           varchar(50) NOT NULL,
  payload        jsonb NOT NULL,
  criado_em      timestamptz NOT NULL,
  processado_em  timestamptz,
  tentativas     integer NOT NULL DEFAULT 0
);
CREATE INDEX ix_outbox_pendente ON outbox (criado_em) WHERE processado_em IS NULL;

-- ───────────────────────────── RLS (DEC-040) ─────────────────────────────
ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant FORCE ROW LEVEL SECURITY;
CREATE POLICY pl_tenant ON tenant FOR ALL
  USING (id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (id = current_setting('app.tenant_id', true)::uuid);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['perfil', 'usuario', 'usuario_perfil', 'projeto', 'vinculo_usuario_projeto',
                           'concessao_acesso_individual', 'sessao', 'token_uso_unico', 'chave_idempotencia',
                           'auditoria', 'outbox']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY pl_%s_tenant ON %I FOR ALL '
                   'USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) '
                   'WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)', t, t);
  END LOOP;
END
$$;
ALTER TABLE falha_login ENABLE ROW LEVEL SECURITY;
ALTER TABLE falha_login FORCE ROW LEVEL SECURITY;  -- sem policy: só mp_auth (BYPASSRLS) acessa

-- ───────────────────────────── Grants ─────────────────────────────
GRANT SELECT ON tenant TO mp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON perfil, usuario, usuario_perfil, projeto, vinculo_usuario_projeto,
  concessao_acesso_individual, sessao, token_uso_unico, chave_idempotencia TO mp_app;
GRANT SELECT, INSERT ON auditoria, outbox TO mp_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mp_manutencao;

GRANT SELECT ON tenant, usuario, token_uso_unico TO mp_auth;
GRANT SELECT, UPDATE (ultima_atividade_em) ON sessao TO mp_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON falha_login TO mp_auth;

-- ───────────────── Funções SECURITY DEFINER mínimas (DEC-046, DEC-090) ─────────────────
CREATE FUNCTION auth_buscar_login(p_email text)
RETURNS TABLE (usuario_id uuid, tenant_id uuid, senha_hash text, situacao text, mfa_ativo boolean, tenant_ativo boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT u.id, u.tenant_id, u.senha_hash, u.situacao, u.mfa_ativo, t.ativo
    FROM usuario u JOIN tenant t ON t.id = u.tenant_id
   WHERE u.email = p_email
$$;

CREATE FUNCTION auth_falha_bloqueio(p_hmac bytea, p_agora timestamptz)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT bloqueado_ate FROM falha_login WHERE email_hmac = p_hmac AND bloqueado_ate > p_agora
$$;

-- Janela fixa de 15 min aberta na primeira falha; a 5ª falha bloqueia por 15 min (DEC-087).
CREATE FUNCTION auth_falha_registrar(p_hmac bytea, p_agora timestamptz, p_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v falha_login%ROWTYPE;
BEGIN
  INSERT INTO falha_login (id, email_hmac, tentativas, janela_inicio)
  VALUES (p_id, p_hmac, 0, p_agora)
  ON CONFLICT (email_hmac) DO NOTHING;

  SELECT * INTO v FROM falha_login WHERE email_hmac = p_hmac FOR UPDATE;
  IF v.janela_inicio + interval '15 minutes' <= p_agora THEN
    v.tentativas := 0;
    v.janela_inicio := p_agora;
  END IF;
  v.tentativas := v.tentativas + 1;
  IF v.tentativas >= 5 THEN
    v.bloqueado_ate := p_agora + interval '15 minutes';
    v.tentativas := 0;
    v.janela_inicio := p_agora;
  END IF;
  UPDATE falha_login
     SET tentativas = v.tentativas, janela_inicio = v.janela_inicio, bloqueado_ate = v.bloqueado_ate
   WHERE email_hmac = p_hmac;
  RETURN CASE WHEN v.bloqueado_ate > p_agora THEN v.bloqueado_ate END;
END
$$;

CREATE FUNCTION auth_falha_limpar(p_hmac bytea)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  DELETE FROM falha_login WHERE email_hmac = p_hmac
$$;

-- Resolve o cookie de sessão ou pré-sessão e renova a atividade da sessão plena.
-- estado: valida | encerrada_mfa_concluido (CA-026b ex. 4, DEC-086) | invalida.
CREATE FUNCTION auth_resolver_sessao(p_hash bytea, p_agora timestamptz)
RETURNS TABLE (sessao_id uuid, tenant_id uuid, usuario_id uuid, tipo text, etapa text, token_id uuid, estado text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  s sessao%ROWTYPE;
  v_tenant_ativo boolean;
BEGIN
  SELECT * INTO s FROM sessao WHERE segredo_hash = p_hash;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT t.ativo INTO v_tenant_ativo FROM tenant t WHERE t.id = s.tenant_id;

  IF s.revogada_em IS NOT NULL THEN
    estado := CASE WHEN s.motivo_revogacao = 'mfa_concluido' THEN 'encerrada_mfa_concluido' ELSE 'invalida' END;
  ELSIF s.expira_absoluta_em <= p_agora
     OR (s.tipo = 'plena' AND s.ultima_atividade_em + interval '30 minutes' <= p_agora)
     OR NOT v_tenant_ativo THEN
    estado := 'invalida';
  ELSE
    estado := 'valida';
    IF s.tipo = 'plena' THEN
      UPDATE sessao SET ultima_atividade_em = p_agora WHERE id = s.id;
    END IF;
  END IF;

  sessao_id := s.id; tenant_id := s.tenant_id; usuario_id := s.usuario_id;
  tipo := s.tipo; etapa := s.etapa; token_id := s.token_id;
  RETURN NEXT;
END
$$;

CREATE FUNCTION auth_buscar_token(p_hash bytea, p_tipo text)
RETURNS TABLE (token_id uuid, tenant_id uuid, usuario_id uuid, expira_em timestamptz, usado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT id, tenant_id, usuario_id, expira_em, usado_em FROM token_uso_unico
   WHERE token_hash = p_hash AND tipo = p_tipo
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['auth_buscar_login(text)', 'auth_falha_bloqueio(bytea, timestamptz)',
                           'auth_falha_registrar(bytea, timestamptz, uuid)', 'auth_falha_limpar(bytea)',
                           'auth_resolver_sessao(bytea, timestamptz)', 'auth_buscar_token(bytea, text)']
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO mp_auth', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO mp_app', f);
  END LOOP;
END
$$;
