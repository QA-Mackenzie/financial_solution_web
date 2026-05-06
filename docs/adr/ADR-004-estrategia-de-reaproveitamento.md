# ADR-004 - Estrategia de reaproveitamento da base desktop

## Status

Aceito

## Contexto

O repositorio contem a aplicacao desktop original. O roadmap da versao web proibe portar Electron, preload, IPC e SQLite local como fundacao da nova arquitetura, mas incentiva reaproveitamento seletivo de dominio e testes confiaveis.

## Decisao

- Solucao_Financeira permanece somente como base de consulta e comparacao funcional
- contratos, logica pura de negocio e fixtures podem ser copiados conscientemente para packages compartilhados
- adaptacoes de infraestrutura, persistencia, orquestracao e runtime serao reescritas para o contexto web
- nenhum desenvolvimento novo acontece dentro de Solucao_Financeira

## Consequencias

- reduzimos o risco de carregar acoplamentos do desktop para a web
- o reaproveitamento exige validacao de equivalencia funcional e matematica por testes
- o custo de migracao fica concentrado em camadas com maior retorno tecnico
