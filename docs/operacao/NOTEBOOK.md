# Operação no notebook

Roteiro da instalação, do backup e da restauração do MinhaPesquisa num notebook Windows 11
(PLANO §4.5 e §9; DEC-113, DEC-114, DEC-115, DEC-117, DEC-118, DEC-121). Só dados
sintéticos (Q-001, DEC-119).

## Antes de instalar

1. **Uso.** O sistema é usado só para teste, com dados sintéticos (DEC-119): nomes fictícios e
   e-mails em `exemplo.test`.
2. **BitLocker** ligado no disco do sistema (T-08). Sem ele a instalação é recusada; como o uso é
   só de teste, `--sem-bitlocker` permite instalar mesmo assim.
3. **Git para Windows** e **Node.js 24** (instalador MSI). Confira com `git --version` e
   `node -v`. Se o PowerShell recusar o `npm` ("execução de scripts foi desabilitada"), rode uma
   vez: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
4. **PostgreSQL 17** pelo instalador do postgresql.org (EDB), com "PostgreSQL Server" e
   "Command Line Tools", porta 5432. A senha do usuário `postgres` deve ter só letras e dígitos,
   porque vai dentro de um endereço de conexão.
   - Para ouvir só no notebook: em `C:\Program Files\PostgreSQL\17\data\postgresql.conf`, troque
     `listen_addresses = '*'` por `listen_addresses = 'localhost'` e reinicie o serviço
     `postgresql-x64-17` (Serviços do Windows).
   - Crie o banco vazio:
     `& "C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres -h 127.0.0.1 minhapesquisa`
5. **Disco externo** para os backups, com a pasta já criada (por exemplo `E:\MinhaPesquisaBackup`).
6. **Código:**
   ```powershell
   git clone https://github.com/carlosyano/minhapesquisa.git C:\MinhaPesquisa
   cd C:\MinhaPesquisa
   npm ci
   ```
   Os comandos `npm run` abaixo rodam nessa pasta.

## Instalação

```powershell
npm run local -- instalar                 # com BitLocker ligado
npm run local -- instalar --sem-bitlocker # só teste, sem BitLocker
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
Ainda não há telas (a TL-001 entra depois). Para conferir o login, noutra janela do PowerShell:

```powershell
$corpo = @{ email = 'ana@exemplo.test'; senha = '<sua senha>' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8080/auth/login -ContentType 'application/json' -Body $corpo
```

A resposta traz `usuario_id`, `nome` e `expira_em`. Com a senha errada, o PowerShell mostra o
erro 401 (ERR-013).

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
   registro externo no disco de backup (DEC-120).
4. Agende o backup de novo (`agendar-backup`).

A restauração é recusada se a pasta de dados já tiver uma instalação ou se o banco não estiver
vazio.

## Refazer do zero (só em teste)

1. `schtasks /Delete /TN MinhaPesquisa\backup /F`
2. Apague a pasta `%LOCALAPPDATA%\MinhaPesquisa`.
3. Recrie o banco: `dropdb` e `createdb` (pasta `bin` do PostgreSQL, `-U postgres -h 127.0.0.1 minhapesquisa`).
