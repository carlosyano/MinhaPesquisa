# Operação no notebook

Roteiro da instalação, do backup e da restauração do MinhaPesquisa num notebook Windows 11
(PLANO §4.5 e §9; DEC-113, DEC-114, DEC-115, DEC-117, DEC-118). Enquanto o GX-001 estiver
pendente, só dados sintéticos (Q-001).

## Antes de instalar

1. BitLocker ligado no disco do sistema (T-08). Sem ele a instalação é recusada; `--sem-bitlocker`
   existe só para testar com dados sintéticos.
2. PostgreSQL 17 instalado no próprio notebook, ouvindo só em 127.0.0.1, com um banco vazio
   (por exemplo `minhapesquisa`) e a senha do superusuário `postgres` à mão.
3. Node.js 24 e o repositório com `npm ci`.
4. Um disco externo para os backups, com a pasta já criada (por exemplo `E:\MinhaPesquisaBackup`).

## Instalação

```powershell
npm run local -- instalar
```

O script pede a conexão de superusuário (`postgres://postgres:<senha>@127.0.0.1:5432/minhapesquisa`),
a pasta de backup, o nome da instituição, o seu nome, o seu e-mail, a senha de acesso e a
**senha de recuperação da chave**. Senhas não aparecem na tela.

A senha de recuperação abre a cópia da chave mestra que vai dentro de cada backup. Sem ela, um
backup não pode ser restaurado em outro notebook. Anote-a e guarde longe do notebook, junto do
disco externo.

Os dados ficam em `%LOCALAPPDATA%\MinhaPesquisa` (ou na pasta de `MP_DADOS`): chave mestra
protegida pelo Windows (`chave-mestra.dpapi`), cópia de recuperação (`chave-mestra.recuperacao`),
senhas do banco protegidas pelo Windows (`segredos.dpapi`), `config.json` e a pasta `imagens`.
Se o PostgreSQL não estiver em `C:\Program Files\PostgreSQL\17\bin`, ajuste `binPostgres` no
`config.json`.

Depois, agende o backup diário (padrão 20:00):

```powershell
npm run local -- agendar-backup 20:00
```

## Uso

```powershell
npm run iniciar
```

A API fica em `http://127.0.0.1:8080`, só no notebook.

## Senha esquecida

```powershell
npm run local -- redefinir-senha
```

Troca a senha, encerra as sessões abertas e registra na auditoria, sem a senha (CA-037).

## Backup

Diário, pelo Agendador de Tarefas, ou à mão com `npm run local -- backup`. Cada backup é um
arquivo `minhapesquisa-AAAAMMDD-HHMMSS.mpbak` (data em UTC) com o banco, as imagens e a cópia
de recuperação da chave, cifrado. Backups com mais de 90 dias são apagados a cada execução
(DEC-033). Com o disco externo desconectado, o backup é recusado. Guarde o disco longe do
notebook.

## Teste mensal de restauração

```powershell
npm run local -- testar-restauracao
```

Pede a senha de recuperação, abre o backup mais recente com ela, restaura num banco temporário,
confere o tenant e as imagens de cada página, mostra a duração e apaga o banco temporário. O
backup avisa quando o último teste aprovado tem mais de 31 dias.

## Restauração em outro notebook

1. Prepare o notebook novo como em "Antes de instalar", com o banco vazio.
2. Rode, com o disco externo conectado:

   ```powershell
   npm run local -- restaurar E:\MinhaPesquisaBackup\minhapesquisa-AAAAMMDD-HHMMSS.mpbak
   ```

3. Antes de voltar a usar, reaplique as eliminações feitas depois da data do backup, a partir do
   registro externo (DEC-062).
4. Agende o backup de novo (`agendar-backup`).

A restauração é recusada se a pasta de dados já tiver uma instalação ou se o banco não estiver
vazio.
