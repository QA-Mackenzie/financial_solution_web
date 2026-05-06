# SHF Web

Nova base da versao web da SHF, desenvolvida em arquitetura greenfield e isolada da aplicacao desktop existente.

## Estrutura

- apps/web: frontend React + Vite
- apps/api: backend Fastify
- packages/contracts: contratos compartilhados de API e sessao
- packages/domain-core: modulos puros compartilhados da base web
- packages/test-fixtures: fixtures reutilizaveis para testes
- infra: infraestrutura local e artefatos operacionais
- docs/adr: decisoes arquiteturais

## Regras do repositorio

- o codigo em Solucao_Financeira existe apenas para consulta
- nenhuma alteracao deve ser feita dentro de Solucao_Financeira
- todo o desenvolvimento da versao web acontece na raiz deste repositorio

## Primeiros comandos

```bash
npm install
npm run infra:up
npm run db:check
npm run dev
```

## Qualidade

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run check
```

## Ambiente local

- o PostgreSQL local sobe via Docker Compose em infra/docker-compose.yml
- o bootstrap do banco cria schema bootstrap, auth, finance e legacy_import com seeds locais multiusuario
- seeds locais disponiveis: alexandre@example.com e beatriz@example.com com a senha senha-segura-123
- o comando npm run db:check valida conectividade, banco atual, usuarios seed, contas seed e lotes staged do importador legado

## Observabilidade inicial

- a API responde com o header x-correlation-id em todas as requisicoes
- erros da API sao serializados em um formato estavel com code, message e requestId
- logs da API ocultam campos sensiveis como senha, cookie e authorization
