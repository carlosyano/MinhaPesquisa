-- CHG-019 (IMP-010, DEC-217, DEC-220 (1), PLANO §5.3): códigos sequenciais de projeto e de formulário
-- (do QR e do rodapé do PDF) e o formulário escolhido no envio, fixo na aplicação (DEC-221).

-- O preenchimento dos existentes cruza tenants: as tabelas têm RLS com FORCE (DEC-046), que vale até para
-- o dono, então o FORCE sai só durante a migração (a transação a desfaz inteira em caso de erro).
ALTER TABLE projeto NO FORCE ROW LEVEL SECURITY;
ALTER TABLE formulario NO FORCE ROW LEVEL SECURITY;
ALTER TABLE aplicacao NO FORCE ROW LEVEL SECURITY;
ALTER TABLE versao NO FORCE ROW LEVEL SECURITY;

-- ENT-004: código do projeto, de 1 a 99999, único no tenant; os existentes recebem pela ordem de criado_em.
ALTER TABLE projeto ADD COLUMN codigo integer;
UPDATE projeto p SET codigo = o.n
  FROM (SELECT id, row_number() OVER (PARTITION BY tenant_id ORDER BY criado_em, id) AS n FROM projeto) o
 WHERE o.id = p.id;
ALTER TABLE projeto
  ALTER COLUMN codigo SET NOT NULL,
  ADD CONSTRAINT ck_projeto_codigo CHECK (codigo BETWEEN 1 AND 99999),
  ADD CONSTRAINT uq_projeto_codigo UNIQUE (tenant_id, codigo);

-- ENT-005: código do formulário, de 1 a 999, único no projeto.
ALTER TABLE formulario ADD COLUMN codigo integer;
UPDATE formulario f SET codigo = o.n
  FROM (SELECT id, row_number() OVER (PARTITION BY projeto_id ORDER BY criado_em, id) AS n FROM formulario) o
 WHERE o.id = f.id;
ALTER TABLE formulario
  ALTER COLUMN codigo SET NOT NULL,
  ADD CONSTRAINT ck_formulario_codigo CHECK (codigo BETWEEN 1 AND 999),
  ADD CONSTRAINT uq_formulario_codigo UNIQUE (projeto_id, codigo);

-- ENT-006: a versão cabe em 2 dígitos no QR.
ALTER TABLE versao ADD CONSTRAINT ck_versao_numero_qr CHECK (numero BETWEEN 1 AND 99);

-- ENT-010: formulário escolhido no envio. Aborta, com relatório, se houver aplicação fora de
-- identificacao_pendente e descartada com versão de outro projeto (DEC-220 (1)).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM aplicacao a
    JOIN versao v ON v.id = a.versao_id JOIN formulario f ON f.id = v.formulario_id
   WHERE f.projeto_id <> a.projeto_id AND a.estado NOT IN ('identificacao_pendente', 'descartada');
  IF n > 0 THEN
    RAISE EXCEPTION 'migracao 0011 abortada: % aplicacao(oes) fora de identificacao_pendente e descartada com versao de outro projeto', n;
  END IF;
END $$;

ALTER TABLE aplicacao ADD COLUMN formulario_id uuid;
ALTER TABLE aplicacao ADD CONSTRAINT fk_aplicacao_formulario FOREIGN KEY (formulario_id, tenant_id) REFERENCES formulario (id, tenant_id);
-- A versão de outro projeto é anulada, e o formulário fica nulo (DEC-234).
UPDATE aplicacao a SET versao_id = NULL
  FROM versao v JOIN formulario f ON f.id = v.formulario_id
 WHERE v.id = a.versao_id AND f.projeto_id <> a.projeto_id;
UPDATE aplicacao a SET formulario_id = v.formulario_id FROM versao v WHERE v.id = a.versao_id;
CREATE INDEX ix_aplicacao_formulario ON aplicacao (formulario_id);

ALTER TABLE projeto FORCE ROW LEVEL SECURITY;
ALTER TABLE formulario FORCE ROW LEVEL SECURITY;
ALTER TABLE aplicacao FORCE ROW LEVEL SECURITY;
ALTER TABLE versao FORCE ROW LEVEL SECURITY;

-- Próximo código: max + 1 na mesma transação da criação, com bloqueio do tenant (projeto) ou da linha
-- do projeto (formulário); passar do limite viola o CHECK, que a API devolve como ERR-001 (DEC-220 (1)).
CREATE FUNCTION mp_codigo_projeto() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.codigo IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('projeto.codigo:' || NEW.tenant_id::text, 0));
    SELECT coalesce(max(codigo), 0) + 1 INTO NEW.codigo FROM projeto WHERE tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END $f$;
CREATE TRIGGER tg_projeto_codigo BEFORE INSERT ON projeto FOR EACH ROW EXECUTE FUNCTION mp_codigo_projeto();

CREATE FUNCTION mp_codigo_formulario() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.codigo IS NULL THEN
    PERFORM 1 FROM projeto WHERE id = NEW.projeto_id FOR UPDATE;
    SELECT coalesce(max(codigo), 0) + 1 INTO NEW.codigo FROM formulario WHERE projeto_id = NEW.projeto_id;
  END IF;
  RETURN NEW;
END $f$;
CREATE TRIGGER tg_formulario_codigo BEFORE INSERT ON formulario FOR EACH ROW EXECUTE FUNCTION mp_codigo_formulario();
