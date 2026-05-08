# Guia de Importacao do render.yaml no Render

## Objetivo

Publicar a Economy Cash no Render importando somente o Blueprint [render.yaml](render.yaml).

Este guia considera a limitacao do plano free: o Render nao aceita preDeployCommand em servicos free. Por isso, o projeto foi ajustado para a API aplicar o schema base automaticamente ao iniciar, antes de abrir a porta.

## O que o Blueprint cria

Ao importar o [render.yaml](render.yaml), o Render provisiona:

1. PostgreSQL gerenciado: economy-cash-db
2. Web Service da API: economy-cash-api
3. Static Site do frontend: economy-cash-app

O Blueprint tambem ja define:

- build e start dos servicos
- health check da API em /health
- rewrite do frontend para /index.html
- DATABASE_URL ligada automaticamente ao Postgres do Blueprint
- SESSION_SECRET gerada automaticamente

## Variaveis que voce precisa preencher

Durante a criacao inicial do Blueprint, o Render vai pedir somente as variaveis com sync: false.

Neste projeto, sao estas:

1. WEB_ORIGIN
Use a URL publica do frontend.

2. VITE_API_URL
Use a URL publica da API.

Se os nomes do Blueprint forem mantidos e os subdominios estiverem disponiveis, os valores tendem a ser:

- WEB_ORIGIN = https://economy-cash-app.onrender.com
- VITE_API_URL = https://economy-cash-api.onrender.com

## Variaveis que o Blueprint resolve sozinho

Voce nao precisa preencher manualmente:

- DATABASE_URL
- SESSION_SECRET
- NODE_VERSION
- API_PORT
- NODE_ENV
- SESSION_COOKIE_NAME
- SESSION_TTL_HOURS
- PASSWORD_RESET_TOKEN_TTL_MINUTES
- EMAIL_VERIFICATION_TOKEN_TTL_HOURS
- CONSENT_VERSION
- LOG_LEVEL
- SKIP_INSTALL_DEPS
- VITE_CONSENT_VERSION

## Passo a passo para importar

1. Faça push do branch que contem o [render.yaml](render.yaml).
2. No Render Dashboard, clique em New > Blueprint.
3. Conecte o repositorio.
4. Escolha o branch correto.
5. Mantenha Blueprint Path como render.yaml.
6. Revise os recursos que serao criados.
7. Preencha os valores solicitados:

- WEB_ORIGIN: URL publica do frontend
- VITE_API_URL: URL publica da API

8. Clique em Deploy Blueprint.

## Onde colocar as variaveis

Essas variaveis sao preenchidas na tela de criacao do Blueprint no proprio Render, nao dentro do YAML nessa etapa.

Resumo:

- WEB_ORIGIN: valor informado no prompt da API
- VITE_API_URL: valor informado no prompt do frontend

Depois da importacao, futuras alteracoes ficam no dashboard de cada servico:

1. API
Servico: economy-cash-api
Tela: Environment
Variavel: WEB_ORIGIN

2. Frontend
Servico: economy-cash-app
Tela: Environment
Variavel: VITE_API_URL

## Como o schema do banco passa a ser criado

No plano free, o Blueprint nao usa mais preDeployCommand.

O schema base e aplicado automaticamente pela propria API ao iniciar, usando estes arquivos versionados no repositorio:

- [infra/postgres/init/001-bootstrap-schema.sql](infra/postgres/init/001-bootstrap-schema.sql)
- [infra/postgres/init/003-auth-schema.sql](infra/postgres/init/003-auth-schema.sql)
- [infra/postgres/init/004-finance-schema.sql](infra/postgres/init/004-finance-schema.sql)

Na pratica, o primeiro deploy segue este fluxo:

1. o Render cria o Postgres
2. a API compila normalmente
3. ao iniciar, a API aplica o schema base no banco
4. depois disso, a API sobe e responde em /health
5. o frontend e publicado como static site

Como os scripts usam create schema if not exists e create table if not exists, essa inicializacao pode rodar novamente sem depender de pre-deploy.

## O que continua manual

Os arquivos de seed de demonstracao continuam opcionais e manuais:

- [infra/postgres/init/002-bootstrap-seed.sql](infra/postgres/init/002-bootstrap-seed.sql)
- [infra/postgres/init/005-finance-seed.sql](infra/postgres/init/005-finance-seed.sql)

Se voce quiser dados de exemplo, aplique esses scripts depois que o banco estiver criado.

## Validacao apos importar

Depois que os recursos ficarem saudaveis:

1. abra a URL da API e teste /health
2. abra a URL do frontend
3. teste login ou cadastro
4. recarregue a pagina para validar sessao

## Problemas mais comuns

### O frontend abre, mas nao autentica

Normalmente WEB_ORIGIN e VITE_API_URL estao com URLs erradas ou desalinhadas.

### A API nao sobe na primeira tentativa

Normalmente o banco ainda nao estava pronto quando a API tentou aplicar o schema. Nesse caso, faca um manual deploy da API novamente depois que o Postgres estiver disponivel.

### Eu mudei o render.yaml e a variavel nao mudou no Render

Isso e esperado para WEB_ORIGIN e VITE_API_URL, porque elas usam sync: false. Depois da criacao inicial, esses ajustes passam a ser feitos no dashboard do servico.

## Resumo operacional

Para usar o projeto no Render free:

1. importe [render.yaml](render.yaml) via New > Blueprint
2. mantenha Blueprint Path como render.yaml
3. preencha WEB_ORIGIN com a URL do frontend
4. preencha VITE_API_URL com a URL da API
5. clique em Deploy Blueprint
6. se a API falhar antes do banco ficar pronto, execute um novo deploy da API
