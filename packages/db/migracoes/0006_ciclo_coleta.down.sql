-- Reverte 0006_ciclo_coleta (PLANO §9.4).
ALTER TABLE projeto
  DROP CONSTRAINT IF EXISTS ck_projeto_coleta,
  DROP COLUMN IF EXISTS objetivo, DROP COLUMN IF EXISTS coordenador,
  DROP COLUMN IF EXISTS coleta_inicio, DROP COLUMN IF EXISTS coleta_fim;
