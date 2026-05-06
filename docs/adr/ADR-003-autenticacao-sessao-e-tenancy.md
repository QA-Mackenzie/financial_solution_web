# ADR-003 - Autenticacao, sessao e tenancy por user_id

## Status

Aceito

## Contexto

A versao web precisa nascer pronta para isolamento por usuario, com sessao segura no backend e sem repetir o modelo local do desktop. As decisoes de autenticacao e tenancy impactam schema, autorizacao e todos os modulos financeiros.

## Decisao

- autenticacao web baseada em sessao mantida no backend e entregue ao browser por cookie HttpOnly
- renovacao, revogacao e persistencia definitiva da sessao entram na Sprint 1
- tenancy adotada desde a modelagem relacional por meio de user_id em todas as entidades de dominio
- autorizacao por recurso sera owner-based, sempre filtrando consultas e mutacoes pelo usuario autenticado

## Consequencias

- o frontend nao sera fonte oficial de identidade nem de autorizacao
- os modulos financeiros futuros ja nascem preparados para isolamento por usuario
- migracoes e importacao legada precisarao sempre mapear ownership explicitamente
