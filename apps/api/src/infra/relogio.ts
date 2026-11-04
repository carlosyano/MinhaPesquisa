// Relógio injetável (PLANO §10.2): toda regra de tempo (sessão, bloqueio, links assinados, backup)
// lê a hora daqui, nunca de Date.now() nem de now() no banco.

export interface Relogio {
  agora(): Date;
}

export const relogioDoSistema: Relogio = { agora: () => new Date() };

export const SEGUNDO = 1000;
export const MINUTO = 60 * SEGUNDO;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;

export function somar(d: Date, ms: number): Date {
  return new Date(d.getTime() + ms);
}
