-- Reverte 0004_cota_reserva_recusada (PLANO §9.4).
ALTER TABLE consumo_ia DROP COLUMN IF EXISTS reserva_recusada_reais;
