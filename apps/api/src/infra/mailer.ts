// Envio de e-mail atrás de interface (DEC-088). O provedor real (Amazon SES) entra com o
// ambiente na nuvem; até lá só existe a captura em memória usada nos testes.

export type TipoEmail = 'convite' | 'recuperacao_senha' | 'reset_mfa';

export interface MensagemEmail {
  para: string;
  tipo: TipoEmail;
  link: string;
  token: string;
}

export interface Mailer {
  enviar(m: MensagemEmail): Promise<void>;
}

export class MailerEmMemoria implements Mailer {
  readonly enviados: Array<MensagemEmail & { enviado_em: Date }> = [];
  constructor(private readonly agora: () => Date) {}
  async enviar(m: MensagemEmail): Promise<void> {
    this.enviados.push({ ...m, enviado_em: this.agora() });
  }
}
