-- IMP-008 (CHG-017): pesquisas sem QR e localização das perguntas pela IA (RN-052, DEC-169 a
-- DEC-193; PLANO §5 e DEC-174). `pedido_titular.aplicacoes_mesmo_nome` (DEC-193) entra com a tabela
-- do pedido do titular, no IMP-004.

-- ENT-006: marca de papel antigo e total de páginas da conferência (DEC-175, DEC-181, DEC-189).
ALTER TABLE versao
  ADD COLUMN papel_antigo   boolean NOT NULL DEFAULT false,
  ADD COLUMN total_paginas  integer CONSTRAINT ck_versao_total_paginas CHECK (total_paginas BETWEEN 1 AND 50);
UPDATE versao SET total_paginas = (mapa_layout ->> 'total_paginas')::int WHERE status = 'publicada' AND mapa_layout IS NOT NULL;
ALTER TABLE versao ADD CONSTRAINT ck_versao_total_publicada CHECK (status <> 'publicada' OR total_paginas IS NOT NULL);

-- A marca e o total não mudam depois da publicação (RN-042), como o conteúdo (0002).
CREATE FUNCTION versao_marca_imutavel() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  IF OLD.status = 'publicada' AND (NEW.papel_antigo IS DISTINCT FROM OLD.papel_antigo OR NEW.total_paginas IS DISTINCT FROM OLD.total_paginas) THEN
    RAISE EXCEPTION 'versão publicada é imutável' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER tg_versao_marca_imutavel BEFORE UPDATE ON versao FOR EACH ROW EXECUTE FUNCTION versao_marca_imutavel();

-- ENT-007: pergunta que o papel antigo não tem (DEC-179).
ALTER TABLE pergunta ADD COLUMN nao_consta boolean NOT NULL DEFAULT false;

-- ENT-004: padrão de data e local do envio de papel antigo (DEC-179, DEC-192); o local, cifrado (DEC-041).
ALTER TABLE projeto
  ADD COLUMN padrao_data_aplicacao   date,
  ADD COLUMN padrao_local_aplicacao  text;

-- ENT-010: de onde veio a versão (DEC-169) e se as páginas foram informadas no identifyApplication,
-- quando a conferência com o QR e a confiança deixa de valer (RN-052, item 3a). Data e local do
-- envio ficam nas colunas da aplicação até a localização confirmar a versão e as páginas (DEC-186).
ALTER TABLE aplicacao
  ADD COLUMN origem_qr           boolean NOT NULL DEFAULT true,
  ADD COLUMN paginas_informadas  boolean NOT NULL DEFAULT false;

-- ENT-025: resultado da localização de cada folha (RN-052, DEC-174 (4)). `localizada_em` nulo = a
-- localizar; `pagina_localizada` e `confianca_localizacao` são o que a IA indicou, para a conferência.
ALTER TABLE pagina_aplicacao
  ADD COLUMN regioes                jsonb,
  ADD COLUMN regiao_assinatura      jsonb,
  ADD COLUMN pagina_localizada      integer,
  ADD COLUMN confianca_localizacao  numeric(5, 4) CONSTRAINT ck_pagina_confianca CHECK (confianca_localizacao BETWEEN 0 AND 1),
  ADD COLUMN localizada_em          timestamptz;

-- Localização: uma tarefa por folha na mesma fila (DEC-174 (3)); `pagina` guarda a ordem de envio da folha.
ALTER TABLE tarefa_leitura
  DROP CONSTRAINT ck_tarefa_grupo,
  ADD CONSTRAINT ck_tarefa_grupo CHECK (grupo IN ('identificacao', 'demais', 'localizacao')),
  ADD COLUMN pagina_aplicacao_id uuid;

-- ENT-009: respondente sem CPF e sem data de nascimento no papel antigo (DEC-172, DEC-176).
ALTER TABLE respondente
  DROP CONSTRAINT ck_respondente_anonimizado,
  ADD CONSTRAINT ck_respondente_cpf CHECK ((cpf_cifrado IS NULL) = (cpf_hash IS NULL));

-- ENT-031: importação de papel antigo (DEC-181).
ALTER TABLE importacao_formulario ADD COLUMN papel_antigo boolean NOT NULL DEFAULT false;

-- Seção 2.9: limite de confiança da localização (DEC-178), padrão no código (escopo.ts).
ALTER TABLE parametro_configuracao
  DROP CONSTRAINT ck_parametro_chave,
  ADD CONSTRAINT ck_parametro_chave CHECK (chave IN (
    'retencao_dias', 'custo_ia_teto', 'limite_confianca', 'grupo_minimo', 'cotacao_usd_brl',
    'retencao_exportacao_dias', 'termo_consentimento', 'limite_confianca_localizacao'));
