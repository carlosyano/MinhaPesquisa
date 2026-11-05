-- Reserva recusada por não caber no teto (DEC-130, CA-030 exemplo 2): a menor reserva recusada no
-- mês. Enquanto o consumido mais essa reserva passar do teto, a cota conta como atingida e a fila
-- espera o teto subir ou o mês virar, sem alternar entre em_leitura e aguardando_cota.

ALTER TABLE consumo_ia
  ADD COLUMN reserva_recusada_reais numeric(14, 6)
    CONSTRAINT ck_consumo_reserva_recusada CHECK (reserva_recusada_reais IS NULL OR reserva_recusada_reais >= 0);
