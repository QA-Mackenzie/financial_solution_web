# ADR-001 - Estrutura monorepo para a versao web

## Status

Aceito

## Contexto

A versao web sera um produto novo. O codigo desktop atual permanece disponivel apenas para consulta e comparacao funcional. A base web precisa nascer com separacao explicita entre frontend, backend e pacotes compartilhados.

## Decisao

Adotar um monorepo npm com a seguinte estrutura:

- apps/web para a interface React
- apps/api para a API Fastify
- packages/contracts para contratos e schemas compartilhados
- packages/domain-core para logica pura reaproveitavel
- packages/test-fixtures para fixtures de teste

## Consequencias

- a aplicacao desktop nao sera portada nem compartilhara infraestrutura de runtime
- o reaproveitamento do desktop sera seletivo e ocorrerá por copia consciente para packages/domain-core ou packages/contracts
- o pipeline de qualidade passa a validar frontend, backend e pacotes em conjunto
