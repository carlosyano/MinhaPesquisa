-- IMP-002: projetos, parâmetros, formulários e versões, aplicações e páginas (RF-003, RF-004,
-- RF-006; ENT-004 a ENT-008, ENT-010, ENT-016, ENT-020, ENT-021, ENT-024, ENT-025).
-- Mesmas regras da 0001: tenant_id em toda tabela, FK composta com tenant, RLS com FORCE.

-- ETag do projeto (REQ §6.5).
ALTER TABLE projeto ADD COLUMN versao integer NOT NULL DEFAULT 1;

-- ENT-020: parâmetros em três níveis (plataforma, tenant, projeto); seção 2.9 da REQ.
CREATE TABLE parametro_configuracao (
  id            uuid PRIMARY KEY,
  tenant_id     uuid CONSTRAINT fk_parametro_tenant REFERENCES tenant (id),
  projeto_id    uuid,
  chave         varchar(100) NOT NULL CONSTRAINT ck_parametro_chave CHECK (chave IN (
                  'retencao_dias', 'custo_ia_teto', 'limite_confianca', 'grupo_minimo', 'cotacao_usd_brl',
                  'retencao_exportacao_dias', 'termo_consentimento')),
  competencia   date,
  valor         text NOT NULL CONSTRAINT ck_parametro_valor CHECK (length(valor) BETWEEN 1 AND 1000),
  alterado_em   timestamptz NOT NULL,
  alterado_por  uuid,
  CONSTRAINT fk_parametro_projeto FOREIGN KEY (projeto_id, tenant_id) REFERENCES projeto (id, tenant_id),
  CONSTRAINT ck_parametro_projeto_tem_tenant CHECK (projeto_id IS NULL OR tenant_id IS NOT NULL),
  CONSTRAINT uq_parametro UNIQUE NULLS NOT DISTINCT (tenant_id, projeto_id, chave, competencia)
);

-- ENT-021: histórico de status do projeto (DEC-027, CA-027).
CREATE TABLE historico_status_projeto (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL,
  projeto_id       uuid NOT NULL,
  status_anterior  varchar(20) CONSTRAINT ck_hsp_anterior CHECK (status_anterior IN ('ativo', 'arquivado')),
  status_novo      varchar(20) NOT NULL CONSTRAINT ck_hsp_novo CHECK (status_novo IN ('ativo', 'arquivado')),
  alterado_em      timestamptz NOT NULL,
  alterado_por     uuid NOT NULL,
  CONSTRAINT fk_hsp_projeto FOREIGN KEY (projeto_id, tenant_id) REFERENCES projeto (id, tenant_id),
  CONSTRAINT fk_hsp_usuario FOREIGN KEY (alterado_por, tenant_id) REFERENCES usuario (id, tenant_id)
);
CREATE INDEX ix_hsp_projeto ON historico_status_projeto (projeto_id, alterado_em);

-- ENT-005: formulário.
CREATE TABLE formulario (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  projeto_id  uuid NOT NULL,
  nome        varchar(200) NOT NULL,
  criado_em   timestamptz NOT NULL,
  CONSTRAINT fk_formulario_projeto FOREIGN KEY (projeto_id, tenant_id) REFERENCES projeto (id, tenant_id),
  CONSTRAINT uq_formulario_id_tenant UNIQUE (id, tenant_id)
);

-- ENT-006: versão. qr_codigo é o identificador opaco impresso no QR (CA-028, T-14): aleatório,
-- sem relação com os IDs internos; gerado na publicação.
CREATE TABLE versao (
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL,
  formulario_id  uuid NOT NULL,
  numero         integer NOT NULL CONSTRAINT ck_versao_numero CHECK (numero >= 1),
  status         varchar(20) NOT NULL DEFAULT 'rascunho' CONSTRAINT ck_versao_status CHECK (status IN ('rascunho', 'publicada')),
  publicada_em   timestamptz,
  mapa_layout    jsonb,
  qr_codigo      varchar(40) CONSTRAINT uq_versao_qr UNIQUE,
  criada_em      timestamptz NOT NULL,
  versao         integer NOT NULL DEFAULT 1,
  CONSTRAINT fk_versao_formulario FOREIGN KEY (formulario_id, tenant_id) REFERENCES formulario (id, tenant_id),
  CONSTRAINT uq_versao_numero UNIQUE (formulario_id, numero),
  CONSTRAINT uq_versao_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT ck_versao_publicada CHECK ((status = 'publicada') = (publicada_em IS NOT NULL AND qr_codigo IS NOT NULL))
);

-- ENT-007: pergunta.
CREATE TABLE pergunta (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid NOT NULL,
  versao_id          uuid NOT NULL,
  codigo             varchar(100) NOT NULL CONSTRAINT ck_pergunta_codigo CHECK (codigo ~ '^[A-Z0-9_]+$'),
  tipo               varchar(30) NOT NULL CONSTRAINT ck_pergunta_tipo CHECK (tipo IN ('escolha_unica', 'multipla_escolha',
                       'escala', 'matriz', 'numero', 'data', 'sim_nao', 'cpf', 'texto_curto', 'texto_livre')),
  enunciado          text NOT NULL CONSTRAINT ck_pergunta_enunciado CHECK (length(enunciado) <= 2000),
  ordem              integer NOT NULL CONSTRAINT ck_pergunta_ordem CHECK (ordem >= 1),
  pagina             integer NOT NULL CONSTRAINT ck_pergunta_pagina CHECK (pagina >= 1),
  obrigatorio        boolean NOT NULL DEFAULT false,
  campo_respondente  varchar(50) CONSTRAINT ck_pergunta_campo_resp CHECK (campo_respondente IN ('nome', 'data_nascimento', 'cpf', 'endereco')),
  campo_aplicacao    varchar(50) CONSTRAINT ck_pergunta_campo_apl CHECK (campo_aplicacao IN ('data_aplicacao', 'local_aplicacao', 'aplicador')),
  sensibilidade      varchar(20) NOT NULL DEFAULT 'saude' CONSTRAINT ck_pergunta_sens CHECK (sensibilidade IN ('identificacao', 'saude', 'outro')),
  valor_min          numeric(10, 2),
  valor_max          numeric(10, 2),
  unidade            varchar(20),
  CONSTRAINT fk_pergunta_versao FOREIGN KEY (versao_id, tenant_id) REFERENCES versao (id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT uq_pergunta_codigo UNIQUE (versao_id, codigo),
  CONSTRAINT uq_pergunta_id_tenant UNIQUE (id, tenant_id),
  -- RN-047 / DEC-097: identificação reservada aos campos do respondente e ao aplicador.
  CONSTRAINT ck_pergunta_identificacao CHECK (
    (sensibilidade = 'identificacao') = (campo_respondente IS NOT NULL OR campo_aplicacao = 'aplicador'))
);

-- ENT-008: opção.
CREATE TABLE opcao (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  pergunta_id  uuid NOT NULL,
  codigo       varchar(50) NOT NULL CONSTRAINT ck_opcao_codigo CHECK (codigo ~ '^[a-z0-9_]+$'),
  rotulo       varchar(200) NOT NULL,
  ordem        integer NOT NULL CONSTRAINT ck_opcao_ordem CHECK (ordem >= 1),
  CONSTRAINT fk_opcao_pergunta FOREIGN KEY (pergunta_id, tenant_id) REFERENCES pergunta (id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT uq_opcao_codigo UNIQUE (pergunta_id, codigo)
);

-- ENT-024: linha de matriz.
CREATE TABLE linha_matriz (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  pergunta_id  uuid NOT NULL,
  codigo       varchar(50) NOT NULL CONSTRAINT ck_linha_codigo CHECK (codigo ~ '^[a-z0-9_]+$'),
  rotulo       varchar(200) NOT NULL,
  ordem        integer NOT NULL CONSTRAINT ck_linha_ordem CHECK (ordem >= 1),
  CONSTRAINT fk_linha_pergunta FOREIGN KEY (pergunta_id, tenant_id) REFERENCES pergunta (id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT uq_linha_codigo UNIQUE (pergunta_id, codigo)
);

-- ENT-016: regra de salto (RN-021, DEC-095). Uma condição por pergunta de destino.
CREATE TABLE regra_salto (
  id                   uuid PRIMARY KEY,
  tenant_id            uuid NOT NULL,
  versao_id            uuid NOT NULL,
  pergunta_origem_id   uuid NOT NULL,
  pergunta_destino_id  uuid NOT NULL,
  opcao_codigo         varchar(50) NOT NULL,
  posicao              integer NOT NULL,  -- ordem em que o administrador listou as regras
  criado_em            timestamptz NOT NULL,
  CONSTRAINT fk_regra_versao FOREIGN KEY (versao_id, tenant_id) REFERENCES versao (id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_regra_origem FOREIGN KEY (pergunta_origem_id, tenant_id) REFERENCES pergunta (id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_regra_destino FOREIGN KEY (pergunta_destino_id, tenant_id) REFERENCES pergunta (id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT uq_regra_destino UNIQUE (pergunta_destino_id),
  CONSTRAINT ck_regra_autorreferencia CHECK (pergunta_origem_id <> pergunta_destino_id)
);

-- ENT-010: aplicação. Os campos de respondente, revisão e conclusão chegam no IMP-003.
CREATE TABLE aplicacao (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL,
  projeto_id       uuid NOT NULL,
  versao_id        uuid,
  estado           varchar(30) NOT NULL DEFAULT 'identificacao_pendente' CONSTRAINT ck_aplicacao_estado CHECK (estado IN (
                     'identificacao_pendente', 'aguardando_cota', 'em_leitura', 'erro_leitura', 'em_revisao',
                     'aguardando_cpf', 'sem_assinatura', 'concluida', 'descartada')),
  aviso            varchar(10),
  assinatura       varchar(20) NOT NULL DEFAULT 'nao_conferida' CONSTRAINT ck_aplicacao_assinatura CHECK (assinatura IN ('presente', 'ausente', 'nao_conferida')),
  criada_em        timestamptz NOT NULL,
  criada_por       uuid NOT NULL,
  versao           integer NOT NULL DEFAULT 1,
  CONSTRAINT fk_aplicacao_projeto FOREIGN KEY (projeto_id, tenant_id) REFERENCES projeto (id, tenant_id),
  CONSTRAINT fk_aplicacao_versao FOREIGN KEY (versao_id, tenant_id) REFERENCES versao (id, tenant_id),
  CONSTRAINT fk_aplicacao_usuario FOREIGN KEY (criada_por, tenant_id) REFERENCES usuario (id, tenant_id),
  CONSTRAINT uq_aplicacao_id_tenant UNIQUE (id, tenant_id)
);
CREATE INDEX ix_aplicacao_projeto_estado ON aplicacao (projeto_id, estado);

-- ENT-025: página da aplicação (imagem guardada sem metadados, RN-040).
CREATE TABLE pagina_aplicacao (
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL,
  aplicacao_id   uuid NOT NULL,
  tipo           varchar(20) NOT NULL DEFAULT 'formulario' CONSTRAINT ck_pagina_tipo CHECK (tipo IN ('formulario', 'assinatura')),
  numero_pagina  integer CONSTRAINT ck_pagina_numero CHECK (numero_pagina >= 1),
  ordem_envio    integer NOT NULL,
  qr_codigo      varchar(200),
  chave_storage  varchar(500) NOT NULL CONSTRAINT uq_pagina_storage UNIQUE,
  sha256         bytea NOT NULL,
  registro_ok    boolean NOT NULL DEFAULT false,
  criado_em      timestamptz NOT NULL,
  expurgada_em   timestamptz,
  CONSTRAINT fk_pagina_aplicacao FOREIGN KEY (aplicacao_id, tenant_id) REFERENCES aplicacao (id, tenant_id)
);
CREATE INDEX ix_pagina_aplicacao ON pagina_aplicacao (aplicacao_id, ordem_envio);

-- ───────────────────────────── RLS (DEC-040) ─────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['historico_status_projeto', 'formulario', 'versao', 'pergunta', 'opcao', 'linha_matriz',
                           'regra_salto', 'aplicacao', 'pagina_aplicacao']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY pl_%s_tenant ON %I FOR ALL '
                   'USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) '
                   'WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)', t, t);
  END LOOP;
END
$$;

-- Parâmetros: o tenant lê os seus e os da plataforma (tenant_id NULL); só grava os seus.
ALTER TABLE parametro_configuracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametro_configuracao FORCE ROW LEVEL SECURITY;
CREATE POLICY pl_parametro_leitura ON parametro_configuracao FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY pl_parametro_escrita ON parametro_configuracao FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY pl_parametro_alteracao ON parametro_configuracao FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- O histórico de status é só de inserção (rastreabilidade, DEC-027).
CREATE TRIGGER tg_hsp_imutavel BEFORE UPDATE OR DELETE ON historico_status_projeto
  FOR EACH ROW EXECUTE FUNCTION auditoria_imutavel();

-- ───────────────────────────── Grants ─────────────────────────────
GRANT SELECT, INSERT, UPDATE ON parametro_configuracao TO mp_app;
GRANT SELECT, INSERT ON historico_status_projeto TO mp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON formulario, versao, pergunta, opcao, linha_matriz, regra_salto,
  aplicacao, pagina_aplicacao TO mp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON parametro_configuracao, historico_status_projeto, formulario, versao,
  pergunta, opcao, linha_matriz, regra_salto, aplicacao, pagina_aplicacao TO mp_manutencao;

-- Defesa em profundidade da RN-042: conteúdo de versão publicada não muda nem pelo banco.
CREATE FUNCTION versao_publicada_imutavel() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
DECLARE
  v_versao uuid;
  v_linha record;
BEGIN
  IF TG_OP = 'DELETE' THEN v_linha := OLD; ELSE v_linha := NEW; END IF;
  IF TG_TABLE_NAME IN ('pergunta', 'regra_salto') THEN
    v_versao := v_linha.versao_id;
  ELSE
    SELECT p.versao_id INTO v_versao FROM pergunta p WHERE p.id = v_linha.pergunta_id;
  END IF;
  IF EXISTS (SELECT 1 FROM versao WHERE id = v_versao AND status = 'publicada') THEN
    RAISE EXCEPTION 'versão publicada é imutável' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pergunta', 'opcao', 'linha_matriz', 'regra_salto']
  LOOP
    EXECUTE format('CREATE TRIGGER tg_%s_versao_publicada BEFORE INSERT OR UPDATE OR DELETE ON %I '
                   'FOR EACH ROW EXECUTE FUNCTION versao_publicada_imutavel()', t, t);
  END LOOP;
END
$$;
