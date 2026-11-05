-- Exportação (RF-010, RF-012, ENT-026, DEC-165). O arquivo gerado tem dados pessoais (RN-051):
-- `chave_storage` vira NULL quando o job apaga o arquivo vencido (DEC-069).

CREATE TABLE exportacao (
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL,
  usuario_id     uuid NOT NULL,
  projeto_ids    uuid[] NOT NULL CONSTRAINT ck_exportacao_projetos CHECK (cardinality(projeto_ids) >= 1),
  formato        varchar(10) NOT NULL CONSTRAINT ck_exportacao_formato CHECK (formato IN ('csv', 'xlsx')),
  escopo         varchar(20) NOT NULL CONSTRAINT ck_exportacao_escopo CHECK (escopo IN ('agregado', 'linha_a_linha', 'linha_por_item')),
  periodo_de     date,
  periodo_ate    date,
  status         varchar(20) NOT NULL DEFAULT 'enfileirada' CONSTRAINT ck_exportacao_status
                   CHECK (status IN ('enfileirada', 'em_andamento', 'concluida', 'falhou', 'cancelada')),
  chave_storage  varchar(500),
  criado_em      timestamptz NOT NULL,
  concluida_em   timestamptz,
  expira_em      timestamptz,
  CONSTRAINT fk_exportacao_usuario FOREIGN KEY (usuario_id, tenant_id) REFERENCES usuario (id, tenant_id),
  CONSTRAINT uq_exportacao_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT ck_exportacao_periodo CHECK ((periodo_de IS NULL) = (periodo_ate IS NULL) AND (periodo_de IS NULL OR periodo_de <= periodo_ate)),
  CONSTRAINT ck_exportacao_concluida CHECK ((status = 'concluida') = (concluida_em IS NOT NULL AND expira_em IS NOT NULL)),
  CONSTRAINT ck_exportacao_arquivo CHECK (chave_storage IS NULL OR status = 'concluida')
);
CREATE INDEX ix_exportacao_vencida ON exportacao (expira_em) WHERE chave_storage IS NOT NULL;

-- Fila da exportação (DEC-165 (4)): uma tarefa por exportação, no mesmo worker e relógio da
-- tarefa_leitura (DEC-124), sem retentativa.
CREATE TABLE tarefa_exportacao (
  id             uuid PRIMARY KEY,
  tenant_id      uuid NOT NULL,
  exportacao_id  uuid NOT NULL,
  executar_em    timestamptz NOT NULL,
  situacao       varchar(20) NOT NULL DEFAULT 'pendente' CONSTRAINT ck_tarefa_exp_situacao
                   CHECK (situacao IN ('pendente', 'concluida', 'falhou')),
  criada_em      timestamptz NOT NULL,
  CONSTRAINT fk_tarefa_exp_exportacao FOREIGN KEY (exportacao_id, tenant_id) REFERENCES exportacao (id, tenant_id),
  CONSTRAINT uq_tarefa_exp_exportacao UNIQUE (exportacao_id)
);
CREATE INDEX ix_tarefa_exp_pendente ON tarefa_exportacao (executar_em) WHERE situacao = 'pendente';

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['exportacao', 'tarefa_exportacao']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY pl_%s_tenant ON %I FOR ALL '
                   'USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) '
                   'WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)', t, t);
  END LOOP;
END
$$;

GRANT SELECT, INSERT, UPDATE ON exportacao, tarefa_exportacao TO mp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON exportacao, tarefa_exportacao TO mp_manutencao;
