# Roadmap de Refatoracao e Verificacoes Tecnicas

## Status

Ativo

## Objetivo do documento

Centralizar o backlog tecnico de refatoracao, limpeza e hardening ja confirmado por evidencias e organiza-lo em ordem de execucao no formato sprints > user stories > tasks.

## Relacao com outros documentos

- Roadmap_Desenvolvimento_Web.md continua como plano macro de produto e entrega por sprint
- docs/process/repository-workflow.md continua definindo branch, release e disciplina de atualizacao de documentacao
- este arquivo concentra apenas a trilha de refatoracao, limpeza tecnica e hardening do codigo ja entregue

## Como este roadmap esta organizado

- o backlog principal agora fica em ordem unica de execucao: primeiro o que bloqueia deploy seguro, depois o que reduz risco alto, depois quick wins P0 e por fim limpezas estruturais e decisoes dependentes de contexto externo
- cada sprint agrupa user stories coerentes e tasks acionaveis
- evidencias, achados confirmados e ameacas complementares ficam em secoes de suporte para manter rastreabilidade sem poluir a fila de execucao
- nenhuma sprint deve ser encerrada sem validacao minima executada e atualizacao do status real neste documento

## Analise consolidada de prioridade

1. a maior urgencia atual e AppSec de borda, porque ha vulnerabilidades criticas que devem ser tratadas antes do proximo deploy
2. o segundo bloco mais urgente e integridade de fluxos sensiveis, porque reset de senha e mutacoes financeiras ainda carregam risco alto
3. os quick wins P0 do frontend entram em seguida por terem baixo risco e retorno imediato, mas nao superam risco de seguranca ativo
4. a limpeza de pacotes internos e contracts vem depois porque pede validacao adicional e, em alguns casos, deprecacao antes de remocao
5. a trilha LegacyImport permanece no fim do backlog executavel porque depende de decisao de produto e arquitetura

## Regras de uso

- registrar aqui apenas achados confirmados por busca, referencias do editor, typecheck, testes ou execucao real
- separar claramente item confirmado de hipotese ou dependencia externa
- em packages compartilhados, tratar export sem consumidor interno como candidato a remocao; apagar somente apos validar consumidores externos ou acordar a deprecacao
- toda remocao ou consolidacao deve registrar a validacao executada
- cada rodada nova deve atualizar status, data e evidencias do item afetado
- nao avancar para a sprint seguinte sem fechar a sprint atual com validacao e roadmap atualizados

## Escopo permanente das proximas rodadas

- codigo morto e export sem consumidor
- duplicacao de logica, API ou mocks
- efeitos React, estado derivado, props e hooks sem uso
- sobre-invalidacao de cache e fan-out desnecessario de refetch
- funcoes puras sem consumidor de producao
- features inacabadas mantidas apenas por teste
- desalinhamento entre contracts, domain-core, api e web
- seguranca de aplicacao: sessao, headers, abuso, exposicao sensivel e configuracao
- logica de negocio sensivel: idempotencia, limites server-side e efeitos repetidos
- guard rails para impedir reintroducao de desperdicio

## Criterios de classificacao

### Urgencia

- critica: precisa entrar antes do proximo deploy ou antes de ampliar superficie do produto
- alta: deve entrar na sprint imediatamente seguinte para evitar risco acumulado ou inconsistencias funcionais
- media: reduz manutencao recorrente e previne reintroducao do problema
- baixa: depende de decisao externa, janela de deprecacao ou iniciativa maior de arquitetura

### Risco

- baixo: remocao local, sem impacto em contrato publico, persistencia ou fluxo de usuario
- medio: remove superficie compartilhada, mock relevante, wiring de modulo ou feature incompleta
- alto: altera contrato publico, comportamento funcional, migracao de dados ou persistencia

### Prioridade

- P0: retorno imediato e baixo risco de aplicacao
- P1: reduz manutencao recorrente ou prepara refatoracao estrutural
- P2: depende de decisao de produto, arquitetura ou consumidores externos

## Guard rails antes de apagar em massa

- confirmar se packages/contracts ou packages/domain-core possuem consumidores fora deste workspace
- nao remover bloco de alias publico sem uma etapa de deprecacao, caso o pacote seja consumido externamente
- para a feature legada de importacao, decidir antes se ela entra de fato no escopo do produto ou sai da base atual

## Visao geral das sprints priorizadas

| Sprint | Urgencia | Prioridade | Foco principal | Motivo da ordem |
| --- | --- | --- | --- | --- |
| Sprint 1 | Critica | P0 | Blindagem imediata de auth e borda HTTP | bloqueia risco antes do proximo deploy |
| Sprint 2 | Alta | P0 | Integridade de reset de senha, idempotencia e configuracao | fecha risco alto do ciclo seguinte |
| Sprint 3 | Alta | P0 | Quick wins do frontend sem consumidor | reduz superficie morta com baixo risco |
| Sprint 4 | Media | P1 | Limpeza de pacotes internos | reduz ruido privado ao monorepo |
| Sprint 5 | Media | P1 | Reducao controlada da superficie de contracts | pede validacao e possivel deprecacao |
| Sprint 6 | Media | P1 | Guard rails automatizados e cobertura de seguranca | evita reintroducao de desperdicio e risco |
| Sprint 7 | Baixa | P2 | Decisao e execucao da trilha LegacyImport | depende de decisao de produto ou arquitetura |
| Sprint 8 | Baixa | P2 | Hardening complementar de operacao e infraestrutura | cobre ameacas fora do codigo |

## Backlog principal por sprint

## Sprint 1 - Blindagem imediata de auth e borda HTTP

Urgencia: critica  
Prioridade: P0  
Objetivo: reduzir abuso imediato e exposicao externa antes de qualquer nova expansao funcional.

### User Story 1 - Proteger auth contra CSRF e brute force

Como time de engenharia, quero bloquear requests cross-site maliciosas e limitar tentativas de auth para reduzir abuso imediato na borda da aplicacao.

#### Tasks

- adicionar defesa CSRF adequada aos endpoints autenticados que operam com cookie cross-site
- aplicar rate limiting especifico nas rotas de login, cadastro e recuperacao de senha
- padronizar resposta de erro e logging para bloqueios de abuso em auth
- criar testes de integracao para origem invalida, ausencia de protecao requerida e excesso de tentativas

### User Story 2 - Reduzir a superficie publica da API

Como time de engenharia, quero endurecer o bootstrap HTTP e minimizar o endpoint de health para remover reconhecimento externo desnecessario.

#### Tasks

- adicionar headers de seguranca no backend e alinhar o comportamento esperado no edge/frontend
- reduzir a resposta publica de /health ao minimo necessario para health check do provedor
- alinhar render.yaml e documentacao operacional ao contrato reduzido de /health
- executar smoke test publico do endpoint apos o ajuste

#### Criterio de aceite

- requests cross-site maliciosas em endpoints mutaveis sao bloqueadas
- auth responde com limite previsivel contra brute force e abuso
- respostas HTTP passam a incluir baseline de headers de seguranca
- /health publico nao expoe metadata util para enumeracao

#### Validacao minima

- npm run test --workspace @economy-cash/api
- testes de integracao para origem invalida e rate limiting nas rotas de auth
- smoke test publico em /health

#### Origem dos achados

- VULN-APPSEC-01
- VULN-APPSEC-02
- VULN-APPSEC-03
- VULN-APPSEC-04

## Sprint 2 - Integridade de reset de senha, idempotencia e configuracao

Urgencia: alta  
Prioridade: P0  
Objetivo: fechar riscos altos do ciclo seguinte em fluxos sensiveis de conta e financeiro.

### User Story 1 - Remover exposicao operacional no reset de senha

Como time de engenharia, quero tirar o token de reset da query string para reduzir vazamento em historico, logs e referer.

#### Tasks

- mover o token de reset para fragmento da URL ou estrategia equivalente que nao va ao servidor
- limpar a URL apos leitura do token no frontend
- revisar o fluxo de previewToken para garantir uso apenas em ambiente local controlado
- adicionar testes do frontend para o novo fluxo de reset

### User Story 2 - Garantir idempotencia nas mutacoes financeiras sensiveis

Como time de engenharia, quero tornar mutacoes financeiras idempotentes para evitar duplicidade por retry, double click ou replay do cliente.

#### Tasks

- definir o contrato de idempotencia para operacoes mutaveis com impacto financeiro
- persistir e reproduzir respostas seguras por chave de idempotencia
- aplicar o padrao aos endpoints financeiros sensiveis mais expostos
- criar testes de repeticao idempotente para os endpoints priorizados

### User Story 3 - Endurecer configuracao sensivel fora de producao

Como time de engenharia, quero impedir que ambientes nao locais iniciem com defaults inseguros para reduzir risco operacional e de configuracao.

#### Tasks

- revisar defaults de DATABASE_URL, SESSION_SECRET e NODE_ENV
- restringir valores de fallback a ambiente local isolado ou remover completamente os defaults inseguros
- documentar o contrato de configuracao obrigatoria por ambiente
- validar o bootstrap da API com a nova politica de configuracao

#### Criterio de aceite

- token de reset nao aparece mais em query string
- repeticao da mesma mutacao com a mesma chave nao produz efeito financeiro duplicado
- ambientes nao locais nao sobem com defaults sensiveis inseguros

#### Validacao minima

- npm run test --workspace @economy-cash/web
- npm run test --workspace @economy-cash/api
- npm run typecheck --workspace @economy-cash/web
- npm run typecheck --workspace @economy-cash/api

#### Origem dos achados

- VULN-APPSEC-05
- VULN-APPSEC-06
- VULN-APPSEC-07

## Sprint 3 - Quick wins do frontend sem consumidor

Urgencia: alta  
Prioridade: P0  
Objetivo: remover codigo morto e cobertura falsa do frontend sem alterar comportamento observavel para o usuario.

### User Story 1 - Remover fluxo morto de horizon settings

Como equipe de frontend, quero apagar hooks, wrappers e mocks sem call site real para reduzir superficie morta e manutencao sem retorno.

#### Tasks

- remover useUpdateHorizonSettingsMutation
- remover financeApi.updateHorizonSettings
- remover a branch PUT /api/v1/horizon/settings em App.test.tsx

### User Story 2 - Remover fluxo morto de variable expense override

Como equipe de frontend, quero apagar hooks, wrappers e mocks sem call site real para reduzir superficie morta e manutencao sem retorno.

#### Tasks

- remover useRemoveVariableExpenseOverrideMutation
- remover financeApi.removeVariableExpenseOverride
- remover a branch DELETE /api/v1/variable-expense-overrides em App.test.tsx

#### Criterio de aceite

- nenhum fluxo de UI perde comportamento observavel
- hooks, wrappers e mocks mortos deixam de existir no frontend
- typecheck e testes do frontend continuam verdes

#### Validacao minima

- npm run typecheck --workspace @economy-cash/web
- npm run test --workspace @economy-cash/web

#### Origem dos achados

- hooks sem consumidor em use-finance.ts
- wrappers HTTP sem consumidor em apps/web/src/lib/api.ts
- mocks de teste inalcancaveis em apps/web/src/App.test.tsx

## Sprint 4 - Limpeza de pacotes internos

Urgencia: media  
Prioridade: P1  
Objetivo: reduzir ruido em fixtures, utilitarios e exports privados ao monorepo.

### User Story 1 - Remover simbolos orfaos privados ao monorepo

Como mantenedor dos pacotes internos, quero remover simbolos claramente orfaos para simplificar leitura e manutencao cotidiana.

#### Tasks

- remover makeSessionFixture
- remover supportedFinancialModules se o package continuar privado ao monorepo
- remover SupportedFinancialModule se o package continuar privado ao monorepo

### User Story 2 - Fechar a decisao de roundCurrency

Como mantenedor do dominio compartilhado, quero decidir o destino de roundCurrency para que o pacote reflita uso real de producao.

#### Tasks

- confirmar se roundCurrency continua sem consumidor de producao
- remover o utilitario e o barrel export se permanecer orfao
- se houver decisao de manter, registrar dono, motivo e ponto de uso esperado

#### Criterio de aceite

- nenhum teste falha por dependencia oculta
- a API publica real dos pacotes internos fica menor e mais clara
- toda manutencao remanescente em roundCurrency fica explicitamente justificada

#### Validacao minima

- npm run typecheck --workspace @economy-cash/domain-core
- npm run test --workspace @economy-cash/domain-core
- npm run typecheck --workspace @economy-cash/test-fixtures

#### Origem dos achados

- makeSessionFixture sem uso no monorepo
- supportedFinancialModules sem consumidor confirmado
- SupportedFinancialModule sem consumidor confirmado
- roundCurrency usado apenas em teste dedicado e barrel export

## Sprint 5 - Reducao controlada da superficie de contracts

Urgencia: media  
Prioridade: P1  
Objetivo: alinhar os tipos exportados com o uso real do sistema e reduzir falso senso de API publica.

### User Story 1 - Revisar tipos sem consumidor confirmado

Como mantenedor de contracts, quero remover ou depreciar tipos sem consumidor real para deixar a superficie publica mais precisa.

#### Tasks

- revisar AuthenticatedUser para remocao ou deprecacao
- revisar DeleteTransactionInput para remocao ou deprecacao
- validar impactos em api, web e consumidores conhecidos antes da remocao

### User Story 2 - Revisar aliases Payload sem consumidor interno

Como mantenedor de contracts, quero classificar aliases Payload em manter, deprecated ou remover para que a API publica reflita apenas o que o sistema usa.

#### Tasks

- inventariar por arquivo os aliases Payload sem consumidor interno confirmado
- classificar cada alias em manter, deprecated ou remover
- aplicar deprecacao primeiro nos casos com chance de consumo externo
- remover aliases confirmadamente mortos apos a janela combinada
- revisar tambem os blocos equivalentes em contract, creditCard, installment, provision e tag

#### Criterio de aceite

- cada tipo e alias revisado possui decisao explicita
- nenhuma remocao quebra consumidores conhecidos
- a superficie publica de contracts fica menor e mais clara

#### Validacao minima

- npm run typecheck --workspace @economy-cash/contracts
- npm run typecheck --workspace @economy-cash/api
- npm run typecheck --workspace @economy-cash/web

#### Origem dos achados

- AuthenticatedUser sem consumidor confirmado
- DeleteTransactionInput sem consumidor confirmado
- blocos Payload de account, analytics, horizon e transaction sem consumidor interno confirmado
- padrao equivalente repetido em contract, creditCard, installment, provision e tag

## Sprint 6 - Guard rails automatizados e cobertura de seguranca

Urgencia: media  
Prioridade: P1  
Objetivo: impedir a reintroducao de desperdicio e automatizar o minimo de seguranca recorrente.

### User Story 1 - Detectar exports orfaos e mocks mortos antes do merge

Como time de engenharia, quero automatizar verificacoes de desperdicio para detectar exports orfaos, mocks mortos e wiring sem consumidor antes do merge.

#### Tasks

- definir a ferramenta principal para unused exports com allowlist explicita
- documentar onde ts-prune pode gerar falso positivo no monorepo
- adicionar rotina leve de revisao de mocks mortos em arquivos de teste grandes
- incorporar a checagem ao fluxo de qualidade ou checklist de PR

### User Story 2 - Formalizar cobertura automatizada para os riscos de AppSec ja mapeados

Como time de engenharia, quero transformar os controles recentes de seguranca em testes e sinais operacionais recorrentes.

#### Tasks

- automatizar testes para CSRF, rate limiting e replay idempotente
- revisar logs de auditoria para eventos de abuso e anomalia
- alinhar headers e politicas do frontend/edge com o endurecimento aplicado na API

#### Criterio de aceite

- o time consegue rodar a checagem de desperdicio em toda sprint
- novos falsos positivos ficam documentados e controlados
- controles de AppSec passam a ter cobertura minima automatizada

#### Validacao minima

- execucao da ferramenta escolhida para unused exports em modo documentado
- atualizacao do checklist de PR ou quality gate equivalente
- testes automatizados cobrindo CSRF, rate limiting e replay

#### Origem dos achados

- Onda 5 do backlog original
- Sprint 3 do backlog de remediacao AppSec original

## Sprint 7 - Decisao e execucao da trilha LegacyImport

Urgencia: baixa  
Prioridade: P2  
Objetivo: encerrar a ambiguidade da trilha LegacyImport em codigo, testes e documentacao.

### User Story 1 - Formalizar a decisao de produto e arquitetura para LegacyImport

Como equipe de backend, quero decidir o destino da importacao legada para parar de manter codigo que nao entrega comportamento de produto.

#### Tasks

- confirmar se existe consumidor real alem de teste
- registrar decisao tecnica sobre productizar ou remover
- refletir a decisao no roadmap principal ou em nota tecnica dedicada

### User Story 2 - Executar o caminho escolhido

Como equipe de backend, quero concluir a decisao tomada para que o modulo deixe de ser uma ambiguidade tecnica.

#### Tasks

- se a decisao for productizar: criar service dedicado, expor rota e contrato, documentar no roadmap principal e ampliar cobertura de integracao
- se a decisao for remover: apagar tipos LegacyImport* nao utilizados, remover LegacyImportRepository e wiring em FinancialDataAccess e remover os testes associados

#### Criterio de aceite

- o modulo deixa de ser ambiguidade tecnica
- a decisao fica refletida em codigo, testes e documentacao

#### Validacao minima

- npm run test --workspace @economy-cash/api
- npm run typecheck --workspace @economy-cash/api
- issue, ADR curta ou nota tecnica registrando a decisao

#### Origem dos achados

- tipos LegacyImport* sem consumidor de producao identificado
- LegacyImportRepository e wiring legacyImport usados externamente apenas em teste

## Sprint 8 - Hardening complementar de operacao e infraestrutura

Urgencia: baixa  
Prioridade: P2  
Objetivo: tratar riscos fora do codigo que continuam relevantes apos o backlog principal.

### User Story 1 - Endurecer a borda operacional do produto

Como time de engenharia, quero validar a borda de infraestrutura para reduzir superficie exposta fora do codigo da aplicacao.

#### Tasks

- validar TLS fim a fim e HSTS no frontend estatico
- revisar comportamento de proxy para os headers de seguranca esperados
- avaliar WAF, DDoS protection e monitoramento de abuso em auth

### User Story 2 - Elevar controles de segredos, privilegios e observabilidade

Como time de engenharia, quero reforcar controles operacionais para reduzir risco de configuracao e abuso em producao.

#### Tasks

- revisar politica de rotacao para SESSION_SECRET, DATABASE_URL e futuras integracoes
- ampliar alertas de brute force, volume anormal de password recovery e repeticao de mutacoes financeiras
- revisar privilegios do usuario de banco utilizado pela API e isolar melhor a superficie de schema bootstrap/legacy

#### Criterio de aceite

- riscos de borda fora do codigo possuem dono, plano e evidencia de validacao
- controles operacionais minimos ficam documentados e verificaveis

#### Validacao minima

- checklist operacional atualizado
- smoke tests de borda e confirmacao de configuracao em ambiente alvo
- documentacao de seguranca e operacao atualizada

#### Origem dos achados

- ameacas nao cobertas pelo codigo na auditoria AppSec de 2026-05-09

## Baseline e evidencias que sustentam a priorizacao

Data da primeira consolidacao: 2026-05-09

### Tecnicas usadas na rodada inicial

- npx tsc --noEmit --noUnusedLocals --noUnusedParameters nos workspaces principais
- ts-prune como heuristica inicial, sempre validado manualmente
- busca textual exata no monorepo para call sites e imports
- referencias do editor para confirmar simbolos realmente sem uso
- leitura manual de arquivos de teste e modulos compartilhados

### Achados confirmados de refatoracao

| Status | Prioridade | Sprint alvo | Arquivo | Elemento | Motivo resumido |
| --- | --- | --- | --- | --- | --- |
| Aberto | P0 | Sprint 3 | apps/web/src/features/finance/use-finance.ts:381 | useUpdateHorizonSettingsMutation | existe apenas como definicao, sem call site na UI |
| Aberto | P0 | Sprint 3 | apps/web/src/features/finance/use-finance.ts:466 | useRemoveVariableExpenseOverrideMutation | existe apenas como definicao, sem call site na UI |
| Aberto | P0 | Sprint 3 | apps/web/src/lib/api.ts:267 | updateHorizonSettings | so e chamado pelo hook morto |
| Aberto | P0 | Sprint 3 | apps/web/src/lib/api.ts:562 | removeVariableExpenseOverride | so e chamado pelo hook morto |
| Aberto | P0 | Sprint 3 | apps/web/src/App.test.tsx:652 | branch PUT /api/v1/horizon/settings | nao existe fluxo atual de UI que exercite essa rota |
| Aberto | P0 | Sprint 3 | apps/web/src/App.test.tsx:1788 | branch DELETE /api/v1/variable-expense-overrides | nao existe fluxo atual de UI que exercite essa rota |
| Aberto | P1 | Sprint 4 | packages/test-fixtures/src/index.ts:26 | makeSessionFixture | nenhuma referencia encontrada no monorepo |
| Aberto | P1 | Sprint 4 | packages/domain-core/src/index.ts:1 | supportedFinancialModules | nenhuma referencia fora da propria definicao de tipo |
| Aberto | P1 | Sprint 4 | packages/domain-core/src/index.ts:13 | SupportedFinancialModule | nenhuma referencia encontrada no monorepo |
| Aberto | P1 | Sprint 4 | packages/domain-core/src/shared/roundCurrency.ts:1 | roundCurrency | so aparece no teste dedicado e no barrel export |
| Aberto | P1 | Sprint 5 | packages/contracts/src/auth.ts:43 | AuthenticatedUser | nenhuma referencia encontrada fora da propria definicao |
| Aberto | P1 | Sprint 5 | packages/contracts/src/transaction.ts:194 | DeleteTransactionInput | nenhuma referencia encontrada fora da propria definicao |
| Aberto | P1 | Sprint 5 | packages/contracts/src/account.ts:81-85 | bloco Payload de account | sem consumidor interno confirmado no monorepo |
| Aberto | P1 | Sprint 5 | packages/contracts/src/analytics.ts:202-224 | bloco Payload de analytics | sem consumidor interno confirmado no monorepo |
| Aberto | P1 | Sprint 5 | packages/contracts/src/horizon.ts:86-92 | bloco Payload de horizon | sem consumidor interno confirmado no monorepo |
| Aberto | P1 | Sprint 5 | packages/contracts/src/transaction.ts:185-207 | bloco Payload de transaction | sem consumidor interno confirmado no monorepo |
| Aberto | P2 | Sprint 7 | apps/api/src/lib/finance-repositories.ts:94-128 | tipos LegacyImport* | sem consumidor de producao identificado |
| Aberto | P2 | Sprint 7 | apps/api/src/lib/finance-repositories.ts:3332-3497 | LegacyImportRepository e legacyImport | uso externo encontrado apenas em teste |

### Arquivos adicionais com o mesmo padrao de aliases Payload

- packages/contracts/src/contract.ts:191-201
- packages/contracts/src/creditCard.ts:299-325
- packages/contracts/src/installment.ts:332-369
- packages/contracts/src/provision.ts:179-194
- packages/contracts/src/tag.ts:52-56

## Rodada 2026-05-09 - Auditoria AppSec

### Escopo

- apps/api: bootstrap HTTP, auth, session, health check, rotas financeiras, erros e configuracao
- apps/web: fluxos de recuperacao e reset de senha
- render.yaml e guias operacionais ligados a health check e variaveis de ambiente

### Comandos e evidencias

- busca textual por csrf, rate limit, headers de seguranca, sinks de XSS, exec/spawn, envs publicas e idempotencia
- leitura manual de apps/api/src/app.ts, apps/api/src/routes/auth.ts, apps/api/src/routes/finance.ts, apps/api/src/lib/auth-service.ts, apps/api/src/lib/database.ts e apps/web/src/features/auth/*
- confirmacao de ownership em apps/api/src/lib/finance-repositories.ts por filtros recorrentes de user_id
- npm audit --all --json sem CVEs conhecidos nesta rodada

### Vulnerabilidades confirmadas que alimentam o backlog

| ID | Severidade | Sprint alvo | Arquivo principal | Resumo |
| --- | --- | --- | --- | --- |
| VULN-APPSEC-01 | Alta | Sprint 1 | apps/api/src/routes/auth.ts + apps/api/src/app.ts | sessao cross-site sem defesa CSRF dedicada |
| VULN-APPSEC-02 | Alta | Sprint 1 | apps/api/src/routes/auth.ts | auth sem rate limiting |
| VULN-APPSEC-03 | Media | Sprint 1 | apps/api/src/app.ts | headers de seguranca ausentes |
| VULN-APPSEC-04 | Media | Sprint 1 | apps/api/src/routes/health.ts + apps/api/src/lib/database.ts + render.yaml | /health expoe metadata sensivel |
| VULN-APPSEC-05 | Media | Sprint 2 | apps/web/src/features/auth/PasswordRecoveryPage.tsx + apps/web/src/features/auth/PasswordResetPage.tsx | token de reset exposto em query string |
| VULN-APPSEC-06 | Alta | Sprint 2 | apps/api/src/routes/finance.ts | mutacoes financeiras sem idempotencia |
| VULN-APPSEC-07 | Baixa | Sprint 2 | apps/api/src/config.ts + apps/api/src/lib/auth-service.ts | defaults e preview sensiveis fora de producao |

### Ameacas nao cobertas pelo codigo nesta rodada

- edge e infraestrutura: validar TLS fim a fim, HSTS no frontend estatico e comportamento de proxy para cabecalhos de seguranca
- segredos e credenciais: politica de rotacao para SESSION_SECRET, DATABASE_URL e futuras integracoes; impedir uso de defaults fora de ambiente local isolado
- protecao de borda: avaliar WAF, DDoS protection e monitoramento de abuso em auth antes de exposicao maior do produto
- observabilidade de seguranca: ampliar alertas de brute force, volume anormal de password recovery e repeticao de mutacoes financeiras
- principio do menor privilegio: revisar privilegios do usuario de banco utilizado pela API e isolar melhor a superficie de schema bootstrap/legacy

## Template para futuras rodadas

### Rodada YYYY-MM-DD - titulo curto

#### Escopo

- modulos analisados
- tipo de verificacao feita

#### Comandos e evidencias

- comandos executados
- consultas ou referencias relevantes

#### Achados confirmados

| Status | Prioridade | Sprint alvo sugerido | Arquivo | Elemento | Motivo | Risco | Acao recomendada |
| --- | --- | --- | --- | --- | --- | --- | --- |

#### Impacto na priorizacao

- sprint criada, antecipada ou reordenada
- dependencias novas identificadas

#### Validacao executada

- comando 1
- comando 2

#### Proximos passos

- passo 1
- passo 2