# Guia de Importacao do render.yaml no Render

## Objetivo

Publicar a SHF Web no Render importando somente o Blueprint [render.yaml](render.yaml), sem criar banco, API e frontend manualmente no dashboard.

## O que o render.yaml cria automaticamente

Ao importar o Blueprint atual, o Render provisiona estes tres recursos:

1. PostgreSQL gerenciado: solucao-financeira-web-db
2. Web Service da API: solucao-financeira-web-api
3. Static Site do frontend: solucao-financeira-web-app

O arquivo tambem ja define:

- plano, regiao e runtime de cada recurso
- comandos de build e start
- health check da API em /health
- rewrite de SPA do frontend para /index.html
- bootstrap automatico do schema base do banco via preDeployCommand da API

## O que voce precisa preencher manualmente

No fluxo inicial de criacao do Blueprint, o Render vai pedir somente as variaveis marcadas com sync: false no [render.yaml](render.yaml).

Neste projeto, sao estas:

1. WEB_ORIGIN
Use a URL publica do frontend.
Valor esperado se os nomes do Blueprint forem mantidos sem conflito:
https://solucao-financeira-web-app.onrender.com

2. VITE_API_URL
Use a URL publica da API.
Valor esperado se os nomes do Blueprint forem mantidos sem conflito:
https://solucao-financeira-web-api.onrender.com

## Variaveis que o Blueprint ja resolve sozinho

Voce nao precisa preencher manualmente estas configuracoes, porque o proprio [render.yaml](render.yaml) ja cuida delas:

- DATABASE_URL: vem automaticamente do Postgres criado pelo Blueprint
- SESSION_SECRET: gerada automaticamente pelo Render
- NODE_VERSION: fixada em 22.12.0
- API_PORT: fixada em 10000
- NODE_ENV: production
- SESSION_COOKIE_NAME: shf_session
- SESSION_TTL_HOURS: 168
- PASSWORD_RESET_TOKEN_TTL_MINUTES: 30
- EMAIL_VERIFICATION_TOKEN_TTL_HOURS: 24
- CONSENT_VERSION: 2026-05
- LOG_LEVEL: info
- SKIP_INSTALL_DEPS: true
- VITE_CONSENT_VERSION: 2026-05

## Antes de importar

Confirme estes pontos:

1. O arquivo [render.yaml](render.yaml) esta commitado e enviado para o branch que voce vai usar.
2. O repositorio esta acessivel pelo Render via GitHub.
3. O Blueprint file path continua sendo render.yaml na raiz do repositorio.
4. Voce sabe quais URLs pretende usar em WEB_ORIGIN e VITE_API_URL.

Se voce for usar os subdominios onrender.com padrao, os nomes atuais do Blueprint sugerem estas URLs:

- frontend: https://solucao-financeira-web-app.onrender.com
- API: https://solucao-financeira-web-api.onrender.com

Se voce for usar dominio customizado desde o inicio, pode informar diretamente esse dominio nas variaveis.

## Passo a passo para importar o Blueprint

1. Faça push do branch com o arquivo [render.yaml](render.yaml).
2. No Render Dashboard, clique em New > Blueprint.
3. Conecte o repositorio deste projeto.
4. Escolha o branch que contem o [render.yaml](render.yaml).
5. No campo Blueprint Path, mantenha render.yaml.
6. O Render vai mostrar a lista de recursos que serao criados a partir do Blueprint.
7. No mesmo fluxo de criacao, preencha as variaveis solicitadas pelo Render:

- WEB_ORIGIN: URL publica do frontend
- VITE_API_URL: URL publica da API

8. Revise os nomes dos recursos que o Render vai criar:

- solucao-financeira-web-db
- solucao-financeira-web-api
- solucao-financeira-web-app

9. Clique em Deploy Blueprint.

## Onde colocar as variaveis durante a importacao

As variaveis manuais nao sao colocadas dentro do arquivo YAML nesse momento. Elas sao preenchidas na tela de criacao do Blueprint no proprio Render.

Resumo pratico:

- WEB_ORIGIN: preencher no prompt exibido para a API durante a criacao inicial do Blueprint
- VITE_API_URL: preencher no prompt exibido para o Static Site durante a criacao inicial do Blueprint

O Render pede esses valores porque, no [render.yaml](render.yaml), eles estao definidos com sync: false.

## Onde editar essas variaveis depois da importacao

Depois que o Blueprint for criado, alteracoes futuras nessas variaveis passam a ser feitas no dashboard de cada servico, porque o Render nao reaplica automaticamente env vars com sync: false em syncs futuros do Blueprint.

Locais de ajuste:

1. API
Servico: solucao-financeira-web-api
Tela: Environment
Variavel para editar: WEB_ORIGIN

2. Frontend
Servico: solucao-financeira-web-app
Tela: Environment
Variavel para editar: VITE_API_URL

## Como preencher WEB_ORIGIN e VITE_API_URL sem errar

As duas variaveis precisam apontar uma para a outra corretamente:

1. WEB_ORIGIN deve ser a URL do frontend
2. VITE_API_URL deve ser a URL da API

Exemplo valido com os nomes atuais do Blueprint:

- WEB_ORIGIN = https://solucao-financeira-web-app.onrender.com
- VITE_API_URL = https://solucao-financeira-web-api.onrender.com

Se voce usar dominios customizados, substitua pelos dominios finais publicados.

## Se a URL final mudar depois do primeiro deploy

Isso pode acontecer se voce trocar dominio, recriar servico ou decidir usar uma URL diferente.

Nesse caso:

1. atualize WEB_ORIGIN no servico da API
2. atualize VITE_API_URL no servico do frontend
3. redeploy os servicos afetados

Se apenas um lado for atualizado, login, sessao e chamadas autenticadas podem falhar por causa de origem incorreta entre frontend e API.

## O que acontece no primeiro deploy do Blueprint

Depois de clicar em Deploy Blueprint, o fluxo esperado e este:

1. o Render cria o Postgres solucao-financeira-web-db
2. a API instala dependencias, compila os workspaces necessarios e executa o preDeployCommand
3. o preDeployCommand da API aplica automaticamente os arquivos:

- [infra/postgres/init/001-bootstrap-schema.sql](infra/postgres/init/001-bootstrap-schema.sql)
- [infra/postgres/init/003-auth-schema.sql](infra/postgres/init/003-auth-schema.sql)
- [infra/postgres/init/004-finance-schema.sql](infra/postgres/init/004-finance-schema.sql)

4. a API sobe com health check em /health
5. o frontend compila e publica apps/web/dist
6. o static site aplica rewrite de /* para /index.html

## O que este Blueprint nao faz automaticamente

O Blueprint atual nao aplica seeds de demonstracao. Ele sobe apenas o schema base.

Os arquivos abaixo continuam opcionais e manuais:

- [infra/postgres/init/002-bootstrap-seed.sql](infra/postgres/init/002-bootstrap-seed.sql)
- [infra/postgres/init/005-finance-seed.sql](infra/postgres/init/005-finance-seed.sql)

Se voce quiser um ambiente com dados de exemplo, aplique esses scripts manualmente depois que o banco estiver criado.

## Validacao apos a importacao

Depois que os tres recursos ficarem saudaveis no Render:

1. abra a URL da API e teste /health
2. confirme que o status da API retorna ok ou degraded com resposta valida
3. abra a URL do frontend
4. confirme que o app carrega sem erro de JavaScript
5. teste login ou cadastro
6. recarregue a pagina para validar persistencia da sessao

## Problemas mais comuns apos importar o Blueprint

### O frontend abre, mas nao autentica

Causa mais comum: WEB_ORIGIN e VITE_API_URL estao apontando para URLs erradas ou desalinhas entre si.

### A API sobe, mas o health falha

Causa mais comum: o banco ainda nao ficou pronto a tempo do primeiro deploy ou houve erro na conexao com DATABASE_URL.

### O deploy do frontend falha no build

O [render.yaml](render.yaml) ja fixa NODE_VERSION em 22.12.0, entao esse caso tende a acontecer apenas se houver mudanca futura no Blueprint ou no projeto.

### Eu alterei o render.yaml e o valor da variavel nao mudou no Render

Isso e esperado para WEB_ORIGIN e VITE_API_URL. Como elas usam sync: false, o Render so pede esses valores na criacao inicial do Blueprint. Depois disso, as mudancas sao feitas manualmente no dashboard do servico.

## Resumo operacional

Para o fluxo atual deste projeto, o caminho correto e:

1. importar [render.yaml](render.yaml) via New > Blueprint
2. manter Blueprint Path como render.yaml
3. preencher WEB_ORIGIN com a URL do frontend
4. preencher VITE_API_URL com a URL da API
5. clicar em Deploy Blueprint
6. depois do primeiro deploy, ajustar essas duas variaveis no dashboard se a URL final publicada diferir do valor informado na importacao
# Guia de Publicacao no Render

## Objetivo

Publicar a SHF Web no Render com a topologia definida no projeto:

- 1 banco PostgreSQL gerenciado
- 1 Web Service para a API Fastify
- 1 Static Site para o frontend React + Vite

## Como este repositorio precisa ser publicado

Este monorepo usa npm workspaces e pacotes internos compartilhados em packages/. Por isso, tanto a API quanto o frontend devem ser configurados no Render a partir da raiz do repositorio, e nao a partir de apps/api ou apps/web isoladamente.

Motivos praticos:

- apps/api depende de @shf/contracts e @shf/domain-core
- apps/web depende de @shf/contracts e @shf/domain-core
- o build precisa instalar e resolver os workspaces na raiz

## Pre-requisitos

Antes de iniciar, tenha em maos:

- conta no Render
- repositorio publicado no GitHub
- branch que sera usada para staging ou producao
- acesso para criar variaveis de ambiente no Render

Tambem configure o runtime Node.js em versao 20.19+ ou 22.12+, porque o build do frontend usa Vite 7.

## Visao geral da implantacao

No Render, voce vai criar os seguintes recursos:

1. PostgreSQL
2. API como Web Service
3. frontend como Static Site

Ordem recomendada:

1. criar o banco
2. aplicar o schema SQL
3. subir a API
4. subir o frontend
5. validar login, sessao e chamadas autenticadas

## Passo 1: criar o PostgreSQL no Render

1. Acesse o dashboard do Render.
2. Clique em New e escolha PostgreSQL.
3. Defina nome, regiao e plano de acordo com o ambiente.
4. Crie o banco e aguarde o provisionamento.
5. Copie a External Database URL gerada pelo Render. Ela sera usada na variavel DATABASE_URL da API.

## Passo 2: inicializar o banco

Hoje o projeto ainda nao possui um pipeline de migracoes automatizadas. O schema precisa ser carregado manualmente no PostgreSQL do Render.

Se voce importar o [render.yaml](render.yaml) da raiz do repositorio como Blueprint do Render, o schema base deixa de ser manual nesse fluxo: a API aplica automaticamente os arquivos 001, 003 e 004 no preDeployCommand. Nessa situacao, esta etapa manual fica restrita aos arquivos de seed de demonstracao, se voce quiser usa-los.

Arquivos SQL relevantes:

- [infra/postgres/init/001-bootstrap-schema.sql](infra/postgres/init/001-bootstrap-schema.sql)
- [infra/postgres/init/003-auth-schema.sql](infra/postgres/init/003-auth-schema.sql)
- [infra/postgres/init/004-finance-schema.sql](infra/postgres/init/004-finance-schema.sql)
- [infra/postgres/init/002-bootstrap-seed.sql](infra/postgres/init/002-bootstrap-seed.sql)
- [infra/postgres/init/005-finance-seed.sql](infra/postgres/init/005-finance-seed.sql)

Ordem obrigatoria de execucao:

1. 001-bootstrap-schema.sql
2. 003-auth-schema.sql
3. 004-finance-schema.sql

Arquivos opcionais de seed:

1. 002-bootstrap-seed.sql
2. 005-finance-seed.sql

Use os arquivos de seed apenas em staging, homologacao ou ambiente de demonstracao. Eles criam dados e usuarios de exemplo.

Se o objetivo for producao limpa, execute somente os arquivos de schema.

Exemplo com psql:

```bash
psql "SUA_DATABASE_URL_DO_RENDER" -f infra/postgres/init/001-bootstrap-schema.sql
psql "SUA_DATABASE_URL_DO_RENDER" -f infra/postgres/init/003-auth-schema.sql
psql "SUA_DATABASE_URL_DO_RENDER" -f infra/postgres/init/004-finance-schema.sql
```

Se quiser subir um ambiente com dados de exemplo:

```bash
psql "SUA_DATABASE_URL_DO_RENDER" -f infra/postgres/init/002-bootstrap-seed.sql
psql "SUA_DATABASE_URL_DO_RENDER" -f infra/postgres/init/005-finance-seed.sql
```

## Passo 3: criar a API no Render

1. No Render, clique em New e escolha Web Service.
2. Conecte o repositorio GitHub deste projeto.
3. Escolha a branch correta.
4. Em Root Directory, use a raiz do repositorio.
5. Escolha o ambiente Node.
6. Configure os comandos abaixo.

Build Command:

```bash
npm install && npm run build --workspace @shf/contracts && npm run build --workspace @shf/domain-core && npm run build --workspace @shf/api
```

Start Command:

```bash
node apps/api/dist/server.js
```

Variaveis de ambiente minimas da API:

- API_PORT: 10000
- NODE_ENV: production
- DATABASE_URL: URL externa do PostgreSQL criado no Render
- WEB_ORIGIN: URL publica do frontend no Render
- SESSION_SECRET: segredo forte com pelo menos 12 caracteres
- SESSION_COOKIE_NAME: shf_session
- SESSION_TTL_HOURS: 168
- PASSWORD_RESET_TOKEN_TTL_MINUTES: 30
- EMAIL_VERIFICATION_TOKEN_TTL_HOURS: 24
- CONSENT_VERSION: 2026-05
- LOG_LEVEL: info

Observacoes importantes:

- o Render espera que o Web Service publique HTTP em 0.0.0.0 e, por padrao, usa a porta 10000
- nesta aplicacao a porta vem de API_PORT; portanto, mantenha API_PORT alinhado com a porta publica configurada no Render
- se voce alterar PORT no Render, atualize API_PORT para o mesmo valor
- o host ja esta pronto para cloud em [apps/api/src/server.ts](apps/api/src/server.ts#L8), porque a API sobe em 0.0.0.0
- CORS e cookie de sessao dependem de WEB_ORIGIN estar exatamente igual a URL publica do frontend

## Passo 4: validar a API publicada

Depois do primeiro deploy da API:

1. Abra a URL publica da API.
2. Chame a rota de health em /health.
3. Verifique se a resposta indica conectividade com o banco.
4. Opcionalmente, configure /health como Health Check Path nas configuracoes avancadas do servico.

Referencias do codigo:

- [apps/api/src/routes/health.ts](apps/api/src/routes/health.ts)
- [apps/api/src/config.ts](apps/api/src/config.ts)
- [apps/api/src/lib/database.ts](apps/api/src/lib/database.ts)

Se a API subir, mas a rota /health retornar erro ou status down, o problema normalmente esta em um destes pontos:

- DATABASE_URL incorreta
- schema do banco nao aplicado
- banco criado em outra regiao ou ainda indisponivel

## Passo 5: criar o frontend no Render

1. No Render, clique em New e escolha Static Site.
2. Conecte o mesmo repositorio.
3. Escolha a branch correta.
4. Em Root Directory, use a raiz do repositorio.
5. Configure os campos abaixo.

Build Command:

```bash
npm install && npm run build --workspace @shf/contracts && npm run build --workspace @shf/domain-core && npm run build --workspace @shf/web
```

Publish Directory:

```text
apps/web/dist
```

Variaveis de ambiente minimas do frontend:

- VITE_API_URL: URL publica da API no Render
- VITE_CONSENT_VERSION: 2026-05

Referencias do codigo:

- [apps/web/src/lib/api.ts](apps/web/src/lib/api.ts)
- [apps/web/src/env.d.ts](apps/web/src/env.d.ts)

## Passo 6: alinhar API e frontend

Depois que os dois servicos existirem, confirme estas duas ligacoes:

1. na API, WEB_ORIGIN deve apontar para a URL do frontend
2. no frontend, VITE_API_URL deve apontar para a URL da API

Se voce recriar um dos servicos e a URL mudar, atualize o outro lado e redeploy.

## Passo 7: testar o fluxo publicado

Checklist minimo apos o deploy:

1. abrir o frontend publicado
2. confirmar que a aplicacao carrega sem erro de JavaScript
3. executar login ou cadastro
4. confirmar que a sessao persiste apos recarregar a pagina
5. testar uma chamada autenticada que use a API
6. abrir a rota /health da API e confirmar banco online

Se houver falha de autenticacao entre frontend e API, revise primeiro:

- WEB_ORIGIN
- VITE_API_URL
- SESSION_SECRET
- cookies bloqueados pelo navegador ou extensoes

## Configuracao recomendada por ambiente

### Staging

- usar banco separado do ambiente de producao
- seeds opcionais podem ser aplicadas se voce quiser um ambiente demonstravel
- branch dedicada de staging

### Producao

- usar banco exclusivo
- nao aplicar arquivos de seed de demonstracao
- gerar novo SESSION_SECRET
- revisar LOG_LEVEL e segredos antes de liberar auto-deploy

## Comandos uteis de validacao antes do push

Execute localmente antes de publicar:

```bash
npm run typecheck
npm run test
npm run build
```

Se quiser validar a conectividade de um banco configurado em DATABASE_URL no ambiente local:

```bash
npm run db:check --workspace @shf/api
```

## Erros comuns no Render

### O build do frontend falha

Causa mais comum: runtime Node antigo. Ajuste para Node 20.19+ ou 22.12+.

### A API sobe, mas o health falha

Causa mais comum: schema do PostgreSQL nao foi carregado.

### O frontend abre, mas nao autentica

Causa mais comum: WEB_ORIGIN e VITE_API_URL apontando para URLs diferentes das URLs publicas ativas.

### A instalacao falha quando o servico aponta para apps/api ou apps/web

Causa mais comum: os workspaces internos deixam de ser resolvidos. Volte a configuracao para a raiz do repositorio.

## Resumo operacional

Para este projeto, o caminho mais seguro no Render e:

1. banco PostgreSQL gerenciado
2. schema aplicado manualmente
3. API publicada como Web Service a partir da raiz do repositorio
4. frontend publicado como Static Site a partir da raiz do repositorio
5. variaveis WEB_ORIGIN e VITE_API_URL alinhadas entre si

Enquanto o projeto nao tiver migracoes automatizadas, o bootstrap do banco continua sendo uma etapa manual obrigatoria.