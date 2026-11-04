-- IMP-003: leitura por IA, revisão, conclusão e vínculo do respondente (RF-005, RF-007, RF-008;
-- ENT-009, ENT-010, ENT-011, ENT-019, ENT-023). Mesmas regras da 0001 e da 0002: tenant_id em
-- toda tabela, FK composta com tenant, RLS com FORCE (DEC-116).
--
-- Valores pessoais lidos (campos do respondente, local, motivos) ficam cifrados pela aplicação
-- com AES-256-GCM (DEC-041, DEC-114) e chegam aqui só como texto "v1:<base64>"; o CPF é buscado
-- pelo HMAC (cpf_hash), nunca pelo valor.

-- ENT-009: respondente.
CREATE TABLE respondente (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL CONSTRAINT fk_respondente_tenant REFERENCES tenant (id),
  nome             text NOT NULL,
  data_nascimento  date,
  cpf_cifrado      text,
  cpf_hash         bytea,
  endereco         text,
  anonimizado      boolean NOT NULL DEFAULT false,
  criado_em        timestamptz NOT NULL,
  versao           integer NOT NULL DEFAULT 1,
  CONSTRAINT uq_respondente_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT uq_respondente_cpf UNIQUE (tenant_id, cpf_hash),
  CONSTRAINT ck_respondente_anonimizado CHECK (
    anonimizado OR (data_nascimento IS NOT NULL AND cpf_cifrado IS NOT NULL AND cpf_hash IS NOT NULL))
);

-- ENT-010: campos de respondente, revisão e conclusão.
ALTER TABLE aplicacao
  ADD COLUMN respondente_id           uuid,
  ADD COLUMN respondente_anterior_id  uuid,
  ADD COLUMN data_aplicacao           date,
  ADD COLUMN local_aplicacao          text,
  ADD COLUMN concluida_em             timestamptz,
  ADD COLUMN cpf_hash                 bytea,
  ADD COLUMN manter_cadastro          jsonb,
  ADD COLUMN cadastro_versao          integer,
  ADD COLUMN motivo_descarte          text,
  ADD COLUMN motivo_reabertura        text,
  ADD COLUMN cpf_exibido_em           timestamptz,
  ADD CONSTRAINT fk_aplicacao_respondente FOREIGN KEY (respondente_id, tenant_id) REFERENCES respondente (id, tenant_id);
CREATE INDEX ix_aplicacao_respondente ON aplicacao (respondente_id) WHERE respondente_id IS NOT NULL;

-- ENT-011: item de resposta, um por pergunta e por linha de matriz (RN-009). Nascem com a
-- leitura (DEC-103).
CREATE TABLE item_resposta (
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL,
  aplicacao_id   uuid NOT NULL,
  pergunta_id    uuid NOT NULL,
  linha_id       uuid,
  valor_ia       text,
  confianca      numeric(5, 4) CONSTRAINT ck_item_confianca CHECK (confianca BETWEEN 0 AND 1),
  valor_final    text,
  estado         varchar(30) NOT NULL DEFAULT 'pendente_leitura' CONSTRAINT ck_item_estado CHECK (estado IN (
                   'pendente_leitura', 'aguardando_condicao', 'confirmado_automaticamente', 'a_revisar', 'confirmado',
                   'corrigido', 'em_branco', 'ilegivel', 'rasurado', 'nao_se_aplica')),
  revisor_id     uuid,
  revisado_em    timestamptz,
  regiao_imagem  jsonb,
  CONSTRAINT fk_item_aplicacao FOREIGN KEY (aplicacao_id, tenant_id) REFERENCES aplicacao (id, tenant_id),
  CONSTRAINT fk_item_pergunta FOREIGN KEY (pergunta_id, tenant_id) REFERENCES pergunta (id, tenant_id),
  CONSTRAINT fk_item_revisor FOREIGN KEY (revisor_id, tenant_id) REFERENCES usuario (id, tenant_id),
  CONSTRAINT uq_item UNIQUE NULLS NOT DISTINCT (aplicacao_id, pergunta_id, linha_id)
);
CREATE INDEX ix_item_aplicacao ON item_resposta (aplicacao_id);

-- ENT-023: alterações de cadastro feitas por cada aplicação, para a reversão na reabertura (CA-042).
CREATE TABLE historico_atributo_respondente (
  id                      uuid PRIMARY KEY,
  tenant_id               uuid NOT NULL,
  respondente_id          uuid NOT NULL,
  aplicacao_id            uuid NOT NULL,
  atributo                varchar(20) NOT NULL CONSTRAINT ck_hist_atributo CHECK (atributo IN ('nome', 'data_nascimento', 'endereco')),
  valor_anterior_cifrado  text,
  valor_gravado_hash      bytea NOT NULL,
  criado_em               timestamptz NOT NULL,
  -- Ordem de registro: o relógio injetado pode repetir o instante (PLANO §10.2).
  seq                     bigint GENERATED ALWAYS AS IDENTITY,
  revertido_em            timestamptz,
  CONSTRAINT fk_hist_respondente FOREIGN KEY (respondente_id, tenant_id) REFERENCES respondente (id, tenant_id),
  CONSTRAINT fk_hist_aplicacao FOREIGN KEY (aplicacao_id, tenant_id) REFERENCES aplicacao (id, tenant_id)
);
CREATE INDEX ix_hist_respondente ON historico_atributo_respondente (respondente_id, atributo, criado_em);

-- Ordem de registro da auditoria, para desempatar eventos no mesmo instante do relógio injetado.
ALTER TABLE auditoria ADD COLUMN seq bigint GENERATED ALWAYS AS IDENTITY;

-- ENT-019: lista de eliminações, reaplicada depois de restaurar um backup (CA-023).
CREATE TABLE lista_eliminacoes (
  id                       uuid PRIMARY KEY,
  tenant_id                uuid NOT NULL CONSTRAINT fk_eliminacao_tenant REFERENCES tenant (id),
  motivo                   varchar(30) NOT NULL DEFAULT 'eliminacao' CONSTRAINT ck_eliminacao_motivo CHECK (motivo IN (
                             'eliminacao', 'anonimizacao_reabertura', 'descarte_aplicacao')),
  respondente_id_original  uuid,
  aplicacao_id             uuid,
  eliminado_em             timestamptz NOT NULL,
  valido_ate               timestamptz NOT NULL,
  CONSTRAINT uq_eliminacao_respondente UNIQUE (tenant_id, respondente_id_original),
  CONSTRAINT uq_eliminacao_aplicacao UNIQUE (tenant_id, aplicacao_id),
  CONSTRAINT ck_eliminacao_alvo CHECK (
    (motivo = 'descarte_aplicacao' AND aplicacao_id IS NOT NULL AND respondente_id_original IS NULL)
    OR (motivo <> 'descarte_aplicacao' AND respondente_id_original IS NOT NULL AND aplicacao_id IS NULL))
);

-- Custo de IA consumido por tenant e mês civil em America/Sao_Paulo (CA-030, DEC-051, DEC-058).
-- Inclui as reservas das chamadas em andamento; o ajuste pelo custo real vem depois da chamada.
CREATE TABLE consumo_ia (
  tenant_id    uuid NOT NULL CONSTRAINT fk_consumo_tenant REFERENCES tenant (id),
  competencia  date NOT NULL,
  valor_reais  numeric(14, 6) NOT NULL DEFAULT 0 CONSTRAINT ck_consumo_valor CHECK (valor_reais >= 0),
  PRIMARY KEY (tenant_id, competencia)
);

-- Fila do worker de leitura (DEC-124): uma tarefa por página e grupo de envio (RN-039), com a
-- hora da próxima tentativa pelo relógio injetado (retentativas em 1, 2 e 4 s, REQ §6.6).
CREATE TABLE tarefa_leitura (
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL CONSTRAINT fk_tarefa_tenant REFERENCES tenant (id),
  aplicacao_id   uuid NOT NULL,
  pagina         integer NOT NULL,
  grupo          varchar(20) NOT NULL CONSTRAINT ck_tarefa_grupo CHECK (grupo IN ('identificacao', 'demais')),
  tentativas     integer NOT NULL DEFAULT 0,
  executar_em    timestamptz NOT NULL,
  situacao       varchar(20) NOT NULL DEFAULT 'pendente' CONSTRAINT ck_tarefa_situacao CHECK (situacao IN ('pendente', 'concluida', 'falhou', 'cancelada')),
  ultima_falha   varchar(20),
  criada_em      timestamptz NOT NULL,
  CONSTRAINT fk_tarefa_aplicacao FOREIGN KEY (aplicacao_id, tenant_id) REFERENCES aplicacao (id, tenant_id)
);
CREATE INDEX ix_tarefa_pendente ON tarefa_leitura (executar_em) WHERE situacao = 'pendente';
CREATE UNIQUE INDEX uq_tarefa_pendente ON tarefa_leitura (aplicacao_id, pagina, grupo) WHERE situacao = 'pendente';

-- ───────────────────────────── RLS (DEC-040) ─────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['respondente', 'item_resposta', 'historico_atributo_respondente', 'lista_eliminacoes',
                           'consumo_ia', 'tarefa_leitura']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY pl_%s_tenant ON %I FOR ALL '
                   'USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) '
                   'WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)', t, t);
  END LOOP;
END
$$;

-- A lista de eliminações só recebe inserções (rastreabilidade, CA-023).
CREATE TRIGGER tg_eliminacoes_imutavel BEFORE UPDATE OR DELETE ON lista_eliminacoes
  FOR EACH ROW EXECUTE FUNCTION auditoria_imutavel();

-- ───────────────────────────── Grants ─────────────────────────────
GRANT SELECT, INSERT, UPDATE ON respondente, item_resposta, consumo_ia, tarefa_leitura TO mp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON historico_atributo_respondente TO mp_app;
GRANT SELECT, INSERT ON lista_eliminacoes TO mp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON respondente, item_resposta, historico_atributo_respondente, lista_eliminacoes,
  consumo_ia, tarefa_leitura TO mp_manutencao;
GRANT UPDATE ON outbox TO mp_app;
