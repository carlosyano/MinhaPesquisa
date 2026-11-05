-- Dados do ciclo de coleta do projeto (ENT-004, DEC-137, CA-049): objetivo, coordenador e período
-- de coleta, todos opcionais. O nome do coordenador é dado pessoal: não vai à IA nem a log.

ALTER TABLE projeto
  ADD COLUMN objetivo text CONSTRAINT ck_projeto_objetivo CHECK (length(objetivo) <= 5000),
  ADD COLUMN coordenador varchar(200),
  ADD COLUMN coleta_inicio date,
  ADD COLUMN coleta_fim date,
  ADD CONSTRAINT ck_projeto_coleta CHECK (coleta_fim IS NULL OR coleta_inicio IS NULL OR coleta_fim >= coleta_inicio);
