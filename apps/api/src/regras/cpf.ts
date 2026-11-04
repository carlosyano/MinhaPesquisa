// CPF lido do papel (RN-012, CA-002): formato canônico de 11 dígitos (REQ §5.4) e dígitos
// verificadores. Funções puras, no escopo do teste de mutação (DEC-052).

/** Tira pontos, traço e espaços; 11 dígitos ou null. */
export function normalizarCpf(lido: string): string | null {
  const s = lido.replace(/[\s.-]/g, '');
  return /^\d{11}$/.test(s) ? s : null;
}

function digito(base: string): number {
  const n = base.length + 1;
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (n - i);
  return ((soma * 10) % 11) % 10;
}

/** CPF canônico com os dois dígitos verificadores corretos; sequências repetidas são inválidas. */
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  return digito(cpf.slice(0, 9)) === Number(cpf[9]) && digito(cpf.slice(0, 10)) === Number(cpf[10]);
}

/** CPF mascarado fora da revisão (RN-013): só os dígitos do meio aparecem. */
export function mascararCpf(cpf: string): string {
  return `***.${cpf.slice(3, 6)}.***-**`;
}
