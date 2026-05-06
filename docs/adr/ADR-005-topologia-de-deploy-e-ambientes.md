# ADR-005 - Topologia de deploy e ambientes iniciais

## Status

Aceito

## Contexto

A Sprint 0 precisa fechar a topologia basica de deploy para evitar replanejamento posterior de frontend, API, banco e seguranca operacional.

## Decisao

- frontend e API serao deployados separadamente
- PostgreSQL sera um servico gerenciado por ambiente fora da aplicacao
- desenvolvimento local usa Docker Compose apenas para o banco
- ambientes previstos desde o inicio: desenvolvimento, staging e producao
- exportacoes e backups serao desacoplados da aplicacao e enviados para storage apropriado nas sprints futuras

## Consequencias

- o backend passa a concentrar sessao, autorizacao, horizonte oficial e integracoes de dados
- o frontend permanece desacoplado de segredos e de acesso direto ao banco
- o repositorio ja pode adotar convencoes de configuracao e release por ambiente
