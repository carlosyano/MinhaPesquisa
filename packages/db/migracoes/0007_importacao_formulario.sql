-- Importação de formulário (RF-011, ENT-031, FL-004, DEC-142). O arquivo enviado é um modelo sem
-- dado pessoal (DEC-133); a pasta (`chave_storage`) e as tarefas são apagadas ao fim.

CREATE TABLE importacao_formulario (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL,
  projeto_id       uuid NOT NULL,
  nome_formulario  varchar(200) NOT NULL,
  estado           varchar(20) NOT NULL DEFAULT 'enfileirada' CONSTRAINT ck_importacao_estado
                     CHECK (estado IN ('enfileirada', 'aguardando_cota', 'em_andamento', 'concluida', 'falhou')),
  aviso            varchar(10),
  total_paginas    integer NOT NULL CONSTRAINT ck_importacao_paginas CHECK (total_paginas BETWEEN 1 AND 50),
  chave_storage    varchar(500),
  formulario_id    uuid,
  versao_id        uuid,
  avisos           jsonb,
  criada_em        timestamptz NOT NULL,
  criada_por       uuid NOT NULL,
  concluida_em     timestamptz,
  CONSTRAINT fk_importacao_projeto FOREIGN KEY (projeto_id, tenant_id) REFERENCES projeto (id, tenant_id),
  CONSTRAINT fk_importacao_formulario FOREIGN KEY (formulario_id, tenant_id) REFERENCES formulario (id, tenant_id),
  CONSTRAINT fk_importacao_versao FOREIGN KEY (versao_id, tenant_id) REFERENCES versao (id, tenant_id),
  CONSTRAINT fk_importacao_usuario FOREIGN KEY (criada_por, tenant_id) REFERENCES usuario (id, tenant_id),
  CONSTRAINT uq_importacao_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT ck_importacao_formulario CHECK ((estado = 'concluida') = (formulario_id IS NOT NULL AND versao_id IS NOT NULL)),
  CONSTRAINT ck_importacao_fim CHECK ((estado IN ('concluida', 'falhou')) = (concluida_em IS NOT NULL))
);
CREATE INDEX ix_importacao_projeto ON importacao_formulario (projeto_id, criada_em);

-- Fila da importação (DEC-142): uma tarefa por página, no mesmo worker e relógio da tarefa_leitura
-- (DEC-124). `suspensa` = aguardando a cota (FL-004); `resultado` guarda a estrutura lida.
CREATE TABLE tarefa_importacao (
  id                   uuid PRIMARY KEY,
  tenant_id            uuid NOT NULL,
  importacao_id        uuid NOT NULL,
  pagina               integer NOT NULL CONSTRAINT ck_tarefa_imp_pagina CHECK (pagina BETWEEN 1 AND 50),
  tentativas           integer NOT NULL DEFAULT 0,
  executar_em          timestamptz NOT NULL,
  situacao             varchar(20) NOT NULL DEFAULT 'pendente' CONSTRAINT ck_tarefa_imp_situacao
                         CHECK (situacao IN ('pendente', 'suspensa', 'concluida')),
  custo_reservado_usd  numeric(12, 6),
  ultima_falha         varchar(20),
  resultado            jsonb,
  criada_em            timestamptz NOT NULL,
  CONSTRAINT fk_tarefa_imp_importacao FOREIGN KEY (importacao_id, tenant_id) REFERENCES importacao_formulario (id, tenant_id),
  CONSTRAINT uq_tarefa_imp_pagina UNIQUE (importacao_id, pagina)
);
CREATE INDEX ix_tarefa_imp_pendente ON tarefa_importacao (executar_em) WHERE situacao = 'pendente';

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['importacao_formulario', 'tarefa_importacao']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY pl_%s_tenant ON %I FOR ALL '
                   'USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) '
                   'WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)', t, t);
  END LOOP;
END
$$;

GRANT SELECT, INSERT, UPDATE ON importacao_formulario TO mp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tarefa_importacao TO mp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON importacao_formulario, tarefa_importacao TO mp_manutencao;
