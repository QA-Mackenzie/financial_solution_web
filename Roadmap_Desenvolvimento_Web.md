# Roadmap Detalhado de Desenvolvimento Web - SHF

## Objetivo do documento

Este documento e autonomo e descreve apenas o desenvolvimento da versao web da SHF. Ele nao depende do roadmap desktop atual e parte do principio de que a versao web sera um produto novo em arquitetura, reaproveitando somente o que fizer sentido da base existente: dominio puro, contratos compartilhados, regras financeiras e testes de regressao.

## Base considerada para este roadmap

- Relatorio tecnico de migracao para web
- Documentacao funcional e arquitetural da aplicacao atual
- Comportamento implementado hoje no desktop
- Dominio financeiro ja existente em TypeScript
- Riscos ja identificados para autenticacao, tenancy, persistencia, seguranca e LGPD

## Diretriz central

O desenvolvimento deve seguir uma estrategia greenfield arquitetural com reaproveitamento seletivo. Em outras palavras:

- nao portar Electron, preload, IPC e SQLite local como base da versao web
- reaproveitar regras puras de negocio, contratos e testes sempre que isso reduzir risco sem carregar decisoes ruins do desktop
- colocar identidade, tenancy, autorizacao, persistencia web e backend oficial antes da expansao de interface
- mover a orquestracao oficial do horizonte para backend ou camada compartilhada governada pelo backend

## Premissas de planejamento

- Cadencia sugerida: sprints de 2 semanas
- Time base sugerido: 1 PO, 1 designer parcial, 2 devs full stack, 1 QA compartilhado
- Estrategia de entrega: vertical slices com base segura antes das features mais visiveis
- Ambiente alvo: desenvolvimento, staging e producao desde cedo
- Escopo da primeira release web: sistema financeiro pessoal autenticado, multiusuario por user_id, com equivalencia funcional em relacao ao nucleo da app desktop atual

## Premissas tecnicas para tornar o roadmap executavel

Para evitar um roadmap abstrato demais, este plano assume a seguinte linha tecnica como ponto de partida:

- Frontend web: React + Vite + React Router + TanStack Query + React Hook Form + Zod
- Backend web: TypeScript + Node.js + Fastify
- Banco de dados: PostgreSQL
- Autenticacao: sessao em cookie HttpOnly + CSRF protection
- Tenancy: isolamento por user_id em todas as entidades de dominio
- Infraestrutura: frontend hospedado separadamente da API, banco gerenciado, object storage para exportacoes e backups, observabilidade centralizada

Se o time trocar alguma dessas decisoes na Sprint 0, o roadmap continua valido, mas as tarefas habilitadoras das primeiras duas sprints devem ser ajustadas.

## Prioridade macro

1. Fundacao de arquitetura, seguranca, identidade e dados
2. Backend oficial e motor do horizonte
3. Fluxos financeiros core em ordem de impacto no horizonte
4. Importacao legada, operacao, compliance e go-live

## Fora de escopo da primeira release web

- chatbot de lancamentos
- aplicacao mobile nativa
- colaboracao multiusuario sobre a mesma conta financeira
- tenancy organizacional com papeis complexos
- categorias customizaveis, caso o time opte por manter catalogo estatico na R1

## Definition of Done por sprint

- backlog da sprint entregue com criterio de aceite validado
- testes unitarios e de integracao do escopo passando
- pelo menos um fluxo ponta a ponta demonstravel em staging ou ambiente equivalente
- observabilidade basica do incremento pronta
- sem regressao conhecida no calculo financeiro afetado
- documentacao curta do incremento atualizada

## Visao macro das sprints

| Sprint | Foco principal | Prioridade | Resultado esperado |
| --- | --- | --- | --- |
| Sprint 0 | Arquitetura alvo e setup do novo produto web | P0 | Novo repositorio estruturado e decisoes criticas fechadas |
| Sprint 1 | Fundacao compartilhada, identidade e shell autenticado | P0 | Usuario autenticado acessa a shell web com sessao segura |
| Sprint 2 | Modelo de dados financeiro multiusuario e autorizacao | P0 | Base relacional pronta para os modulos financeiros |
| Sprint 3 | Contas e lancamentos manuais end-to-end | P0 | Primeira entrada real de dados financeiros no sistema web |
| Sprint 4 | Horizonte oficial no backend e dashboard base | P0 | Horizonte de 24 meses deixa de depender do renderer desktop |
| Sprint 5 | Contratos recorrentes e reajustes | P0 | Receitas e despesas fixas passam a alimentar o horizonte |
| Sprint 6 | Cartoes de credito e faturas | P0 | Credito fica separado do caixa com impacto no vencimento |
| Sprint 7 | Parcelamentos e antecipacao | P0 | Parcelas futuras recalculam o horizonte com confianca |
| Sprint 8 | Provisoes e despesas variaveis com override | P1 | Reserva de caixa e projecao variavel ficam operacionais |
| Sprint 9 | Tags, categorias, consulta e analytics | P1 | Leitura analitica e filtros avancados ficam disponiveis |
| Sprint 10 | Exportacao, importacao legada e portabilidade | P1 | Caminho seguro para migrar usuarios do desktop |
| Sprint 11 | Hardening de seguranca, LGPD e operacao | P1 | Sistema pronto para exposicao controlada |
| Sprint 12 | Homologacao, piloto, go-live e estabilizacao | P0 | Publicacao com rollback, monitoramento e suporte assistido |

---

## Sprint 0 - Arquitetura alvo e setup do novo produto web

Status: concluida em 2026-05-06

### Objetivo

Fechar as decisoes estruturais que evitam retrabalho caro nas sprints seguintes e iniciar o novo produto com fundacao correta.

### Entregaveis

- ADRs tecnicos das decisoes criticas
- estrutura inicial do novo repositorio
- pipeline de qualidade minima funcionando
- ambiente local padronizado
- baseline de seguranca e observabilidade

### Backlog recomendado

- [x] Definir e aprovar ADR para autenticacao, tenancy, banco de dados, backend, frontend e topologia de deploy
- [x] Definir a estrategia de reaproveitamento do codigo atual: o que vira pacote compartilhado, o que sera reescrito e o que sera descartado
- [x] Estruturar o novo repositorio em apps e packages, separando web-app, api, domain-core, contracts, test-fixtures e infra
- [x] Configurar lint, formatacao, testes, conventional commits ou politica equivalente e quality gate de PR
- [x] Subir ambiente local com banco PostgreSQL, variaveis de ambiente e seeds minimos
- [x] Configurar CI para install, lint, build e testes
- [x] Definir politica de segredos, rotacao e convencao de configuracao por ambiente
- [x] Criar o primeiro threat model com foco em login, sessao, dados financeiros e exportacoes
- [x] Definir padrao de logging estruturado, correlation id e erros serializaveis
- [x] Documentar Definition of Done, fluxo de branch e release do novo repositorio

### Gate de saida

O time consegue clonar o novo repositorio, subir app e API localmente, conectar ao banco, executar a pipeline minima e explicar as decisoes estruturais sem ambiguidade.

### Implementado nesta sprint

- monorepo npm na raiz com apps/web, apps/api, packages/contracts, packages/domain-core, packages/test-fixtures e infra
- shell web inicial em React + Vite com rotas publicas e privadas e dashboard base
- API Fastify com sessao em cookie, health check, correlation id e erros serializaveis
- baseline de observabilidade com logging estruturado e redacao de campos sensiveis
- Docker Compose com PostgreSQL local, bootstrap SQL e seeds minimos
- ADRs de estrutura, stack, autenticacao, tenancy, reaproveitamento e topologia de deploy
- politica de segredos, threat model inicial, workflow do repositorio e template de PR

### Validacao executada

- npm run test --workspace @shf/api
- npm run check
- docker compose -f infra/docker-compose.yml config
- npm run infra:up
- npm run db:check
- bootstrap real da API em http://127.0.0.1:3001
- bootstrap real do frontend em http://localhost:5173

---

## Sprint 1 - Fundacao compartilhada, identidade e shell autenticado

### Objetivo

Criar a base compartilhada de dominio/contratos e entregar o primeiro fluxo autenticado seguro da aplicacao web.

### Entregaveis

- pacotes compartilhados iniciais publicados no workspace
- modelo base de usuario e sessao funcionando
- shell web com rotas publicas e privadas
- usuario autenticado acessando uma area logada vazia

### Backlog recomendado

- [ ] Extrair para package compartilhado os contratos reutilizaveis de contas, transacoes, contratos, cartoes, parcelamentos, provisoes, tags e horizonte
- [ ] Portar para package compartilhado os modulos puros de dominio com maior estabilidade matematica e baixo acoplamento de infra
- [ ] Migrar e adaptar os testes de dominio mais confiaveis para o novo repositorio
- [ ] Modelar tabelas de users, sessions, password_reset_tokens, email_verification_tokens, consents e audit_logs
- [ ] Implementar cadastro inicial, login, logout e renovacao de sessao
- [ ] Implementar hashing forte de senha e cookies seguros com expiracao definida
- [ ] Criar paginas de login, cadastro, recuperacao e reset de senha
- [ ] Criar shell privada com navegacao basica, protecao de rotas e bootstrap do usuario autenticado
- [ ] Registrar eventos minimos de auditoria para login, logout, reset e falhas de autenticacao
- [ ] Cobrir auth com testes de integracao, casos de credencial invalida e expiracao de sessao

### Gate de saida

Um usuario consegue criar conta, autenticar, encerrar sessao e acessar a shell privada da aplicacao sem expor dados ou rotas sem protecao.

---

## Sprint 2 - Modelo de dados financeiro multiusuario e autorizacao

### Objetivo

Preparar a base relacional do produto web com isolamento por usuario e autorizacao por recurso desde o inicio.

### Entregaveis

- schema financeiro multiusuario versionado
- camada de autorizacao por dono do recurso pronta
- repositorios base e mapeadores criados
- prova inicial da estrategia de importacao do legado

### Backlog recomendado

- [ ] Modelar tabelas core com user_id: accounts, manual_transactions, recurring_contracts, recurring_contract_adjustments, credit_cards, credit_card_purchases, installment_plans, installment_operations, provisions, variable_expense_overrides, tags e tabelas M:N
- [ ] Criar indices e constraints compostas por user_id onde antes existiam restricoes globais
- [ ] Redesenhar app_settings para escopo por usuario
- [ ] Implementar camada de repositorios ou data access para entidades base
- [ ] Implementar middleware ou componente equivalente de autorizacao owner-based
- [ ] Garantir que toda consulta e mutacao aplique escopo do usuario autenticado
- [ ] Definir schema de auditoria para operacoes sensiveis de dominio
- [ ] Criar fixtures e seeds de desenvolvimento com multiplos usuarios para testar isolamento
- [ ] Criar prova de conceito do importador do SQLite legado para staging tables ou pipeline temporario
- [ ] Cobrir com testes de integracao os cenarios de acesso indevido e cross-user leakage

### Gate de saida

A aplicacao possui base relacional segura, com isolamento por usuario comprovado por teste automatizado e pronta para receber os primeiros modulos funcionais.

---

## Sprint 3 - Contas e lancamentos manuais end-to-end

### Objetivo

Entregar o primeiro fluxo financeiro real e utilizavel na versao web, formando a base de saldo atual.

### Entregaveis

- CRUD de contas
- CRUD de lancamentos manuais
- saldo atual por conta e consolidado
- primeira trilha E2E financeira da web

### Backlog recomendado

- [ ] Implementar casos de uso e endpoints de contas: criar, editar, arquivar, listar e obter snapshot
- [ ] Portar e adaptar as regras de validacao de accountInput e accountSnapshot para o novo backend
- [ ] Implementar casos de uso e endpoints de transacoes manuais
- [ ] Portar e adaptar transactionInput e transactionSnapshot
- [ ] Criar tela web de contas com validacoes, empty states e feedback de erro
- [ ] Criar tela web de lancamentos com criacao, edicao, exclusao, filtros basicos e associacao a conta
- [ ] Exibir saldo por conta e saldo consolidado atual na shell privada
- [ ] Registrar auditoria para criacao, edicao e exclusao de contas e lancamentos
- [ ] Escrever testes E2E para login > criar conta > lancar entrada > lancar saida > validar saldo final
- [ ] Publicar documentacao curta do modelo de saldo atual e das regras de centavos

### Gate de saida

O usuario consegue montar sua base financeira atual na web e o sistema responde com saldos corretos e rastreaveis.

---

## Sprint 4 - Horizonte oficial no backend e dashboard base

### Objetivo

Transformar o horizonte em calculo oficial de backend e entregar a principal proposta de valor da aplicacao web.

### Entregaveis

- API oficial do horizonte de 24 meses
- configuracoes do horizonte por usuario
- dashboard base da web consumindo o backend
- regressao matematica comparada com a base atual

### Backlog recomendado

- [ ] Portar o motor de financialHorizon para a nova arquitetura sem dependencia de renderer
- [ ] Criar servico de orquestracao do horizonte no backend usando contas e lancamentos ja implementados
- [ ] Implementar configuracoes por usuario para margem de seguranca e janela de media movel
- [ ] Criar endpoint de leitura do horizonte com breakdown mensal e classificacao de risco
- [ ] Criar dashboard web base para exibir 24 meses, saldos, entradas, saidas e status healthy/attention/critical
- [ ] Implementar cache estrategico e instrumentacao de performance para leitura do horizonte
- [ ] Reaproveitar fixtures do dominio atual para testes de regressao
- [ ] Validar equivalencia matematica entre cenarios do desktop e do backend web para o escopo ja migrado
- [ ] Criar testes de contrato de API para payload do horizonte
- [ ] Documentar que o calculo oficial do horizonte passa a residir no backend

### Gate de saida

O horizonte deixa de ser logica acoplada a UI e passa a ser um servico oficial, auditavel e testado da versao web.

---

## Sprint 5 - Contratos recorrentes e reajustes

### Objetivo

Adicionar ao sistema web as recorrencias fixas que alimentam o horizonte automatico.

### Entregaveis

- modulo de contratos com CRUD, reajuste e encerramento
- contratos integrados ao horizonte
- casos de regressao cobrindo vigencia e historico futuro

### Backlog recomendado

- [ ] Implementar schema, repositorio e endpoints de contratos recorrentes
- [ ] Portar contractInput, contractProjection e contractSnapshot
- [ ] Implementar reajustes com vigencia futura e historico preservado
- [ ] Implementar encerramento e cancelamento sem corromper meses passados
- [ ] Integrar contratos ao servico oficial do horizonte
- [ ] Criar UI de contratos com cadastro, reajuste e encerramento
- [ ] Atualizar dashboard e horizonte para evidenciar ocorrencias recorrentes
- [ ] Escrever testes de integracao para vigencia, encerramento e recalculo do horizonte
- [ ] Escrever E2E para criar contrato, reajustar, validar efeito apenas futuro
- [ ] Revisar auditoria de eventos do modulo

### Gate de saida

Receitas e despesas recorrentes passam a ser calculadas automaticamente na web com comportamento equivalente ao dominio atual.

---

## Sprint 6 - Cartoes de credito e faturas

### Objetivo

Separar corretamente credito e caixa no sistema web, incluindo compras, ciclo de fatura e vencimento.

### Entregaveis

- modulo de cartoes operacional
- compras e faturas integradas ao horizonte
- visao confiavel de impacto no caixa apenas no vencimento

### Backlog recomendado

- [ ] Implementar schema e endpoints de cartoes e compras no credito
- [ ] Portar creditCardInput, creditCardPurchaseInput e creditCardBilling
- [ ] Implementar preview de fatura, fechamento, vencimento e conta pagadora padrao
- [ ] Integrar o debito consolidado da fatura ao horizonte no mes correto
- [ ] Criar UI de cartoes com cadastro, compra, visao de fatura e historico
- [ ] Criar validacoes para ciclo de fechamento, limite e datas invalidas
- [ ] Criar testes de regressao com compras em datas proximas ao fechamento
- [ ] Criar E2E cobrindo compra no cartao e reflexo apenas no vencimento
- [ ] Adicionar eventos de auditoria para criacao de compra, alteracao de cartao e fechamento de fatura
- [ ] Medir impacto de performance do calculo de billing sobre o horizonte agregado

### Gate de saida

O sistema web representa credito sem distorcer o caixa atual e sem perder equivalencia com a regra financeira do desktop.

---

## Sprint 7 - Parcelamentos e antecipacao

### Objetivo

Entregar o fluxo que mais exige recalculo confiavel do futuro: parcelamentos e quitacao antecipada.

### Entregaveis

- modulo de parcelamentos
- antecipacao de parcelas remanescentes
- recalculo confiavel do horizonte apos operacoes futuras

### Backlog recomendado

- [ ] Implementar schema e endpoints de installment_plans e installment_operations
- [ ] Portar installmentInput, installmentSchedule e installmentCardProjection
- [ ] Permitir parcelamento vinculado a cartao quando aplicavel
- [ ] Implementar antecipacao parcial ou total das parcelas restantes
- [ ] Integrar parcelamentos ao horizonte oficial e ao modulo de cartoes
- [ ] Criar UI para criar parcelamento, visualizar cronograma e antecipar parcelas
- [ ] Criar testes de regressao para cronograma, soma total e quitacao antecipada
- [ ] Criar E2E especifico para parcelamento e recalculo do horizonte
- [ ] Revisar idempotencia e consistencia transacional das operacoes de antecipacao
- [ ] Garantir rastreabilidade em auditoria das alteracoes futuras geradas por antecipacao

### Gate de saida

Parcelamentos passam a ser uma feature confiavel na web, com recalculo transparente e matematicamente consistente do futuro.

---

## Sprint 8 - Provisoes e despesas variaveis com override

### Objetivo

Completar o nucleo de planejamento financeiro com reserva de caixa e previsao de despesas variaveis.

### Entregaveis

- modulo de provisoes
- projecao de despesas variaveis por media movel
- override manual por mes
- impacto oficial no horizonte

### Backlog recomendado

- [ ] Implementar schema e endpoints de provisoes
- [ ] Portar provisionInput e provisionProjection
- [ ] Implementar variable_expense_overrides por usuario
- [ ] Portar variableExpenseProjection e integrar ao horizonte oficial
- [ ] Criar UI de provisoes com meta, data de resgate e distribuicao mensal
- [ ] Criar UI de override de despesa variavel por mes futuro
- [ ] Integrar configuracao da janela de media movel no backend e no frontend
- [ ] Criar testes de regressao para blindagem de caixa e sobrescrita manual
- [ ] Criar E2E cobrindo provisao e override com reflexo no horizonte
- [ ] Revisar visual do horizonte para diferenciar provisoes, despesas variaveis calculadas e overrides manuais

### Gate de saida

O horizonte web passa a representar nao apenas o historico e o fixo, mas tambem reserva de caixa e previsao dinamica de variaveis.

---

## Sprint 9 - Tags, categorias, consulta e analytics

### Objetivo

Entregar a camada de leitura e investigacao dos dados financeiros para uso diario e decisao.

### Entregaveis

- tags operacionais
- consulta de lancamentos aprimorada
- analytics por periodo, categoria e tag
- diretriz fechada para categorias na R1

### Backlog recomendado

- [ ] Fechar a decisao de produto para categorias: manter catalogo estatico na R1 ou persistir catalogo customizavel
- [ ] Implementar CRUD de tags e associacao a transacoes e compras no credito
- [ ] Portar tagInput e analyticsSnapshot
- [ ] Criar endpoints de analytics por periodo, categoria, tag e entidade financeira
- [ ] Criar tela de consulta de lancamentos com filtros por periodo, conta, categoria, tag e tipo
- [ ] Criar tela de analytics com visoes sumarizadas, tabelares e graficos leves se aprovados
- [ ] Criar testes de integracao para consultas e agregacoes
- [ ] Criar E2E cobrindo filtro cruzado por categoria e tag
- [ ] Revisar performance de consultas agregadas em bases medias e grandes
- [ ] Documentar limites de escopo da R1 para analytics e categorias

### Gate de saida

O usuario consegue nao apenas registrar e projetar, mas tambem ler e analisar seus dados com filtros consistentes.

---

## Sprint 10 - Exportacao, importacao legada e portabilidade

### Objetivo

Criar o caminho seguro de migracao do desktop para a web e implementar portabilidade de dados do titular.

### Entregaveis

- importador do legado funcional
- exportacao completa por usuario
- reconciliacao entre base desktop e base web
- runbook de migracao

### Backlog recomendado

- [ ] Implementar importador lendo diretamente o SQLite legado, sem depender apenas do export JSON parcial
- [ ] Mapear e importar contas, transacoes, contratos, cartoes, compras, parcelamentos, provisoes, tags, overrides e configuracoes relevantes do horizonte
- [ ] Criar mecanismo de reconciliacao por contagem, somatorio monetario e amostragem de cenarios criticos
- [ ] Implementar exportacao completa dos dados do usuario na versao web
- [ ] Implementar fluxo operacional de migracao assistida de usuarios do desktop
- [ ] Registrar auditoria para importacoes, exportacoes e falhas de reconciliacao
- [ ] Criar testes automatizados com base anonimizada do legado
- [ ] Criar checklist de suporte para migracao e retorno em caso de inconsistencias
- [ ] Definir politica de versionamento do importador para schemas legados antigos
- [ ] Documentar criterios de aceite da migracao e estrategia de rollback de dados

### Gate de saida

Existe um processo repetivel e validado para levar um usuario do desktop para a web com baixa chance de perda ou distorcao de dados.

---

## Sprint 11 - Hardening de seguranca, LGPD e operacao

### Objetivo

Levar o produto de funcional para operacionalmente seguro e aderente ao contexto web real.

### Entregaveis

- checklist de seguranca aplicado
- controles LGPD operacionais
- observabilidade e alertas maduros
- ambiente staging pronto para homologacao forte

### Backlog recomendado

- [ ] Implementar e validar CSRF protection, rate limiting, headers de seguranca e CSP
- [ ] Revisar e endurecer cookies, sessoes, revogacao e expiracao
- [ ] Implementar sanitizacao e mascaramento de logs para dados sensiveis
- [ ] Criar trilha separada de auditoria para eventos relevantes de negocio e seguranca
- [ ] Implementar exclusao, anonimização ou fluxo equivalente de atendimento ao titular conforme decisao juridica/produto
- [ ] Implementar politica de retencao de logs, tokens e dados auxiliares
- [ ] Criptografar backups e definir runbooks de restauracao
- [ ] Integrar monitoramento, alertas, dashboards operacionais e health checks
- [ ] Executar testes de carga seletivos no login, leitura do horizonte e consultas mais pesadas
- [ ] Executar revisao de autorizacao por recurso e casos de IDOR manualmente e por automacao

### Gate de saida

O produto esta preparado para ser exposto a usuarios reais com controles tecnicos, operacionais e regulatorios minimamente robustos.

---

## Sprint 12 - Homologacao, piloto, go-live e estabilizacao

### Objetivo

Publicar a versao web com risco controlado, rollback previsto e operacao assistida nas primeiras semanas.

### Entregaveis

- homologacao funcional concluida
- piloto controlado executado
- go-live com monitoramento ativo
- plano de estabilizacao e backlog pos-lancamento

### Backlog recomendado

- [ ] Fechar suite de testes E2E dos fluxos criticos: auth, contas, lancamentos, horizonte, contratos, cartoes, parcelamentos, provisoes e migracao
- [ ] Executar homologacao em staging com base piloto e roteiro formal
- [ ] Rodar migracoes reais em lote controlado ou por cohort de usuarios
- [ ] Validar dashboards de monitoramento, alertas e trilhas de auditoria em ambiente de producao
- [ ] Preparar runbook de incidentes, rollback de deploy e rollback operacional de migracao
- [ ] Publicar documentacao de suporte, FAQ de migracao e procedimentos internos
- [ ] Liberar piloto fechado e coletar feedback estruturado
- [ ] Corrigir defeitos criticos e medium antes de expandir a base de usuarios
- [ ] Realizar go-live progressivo com janela assistida de suporte
- [ ] Consolidar backlog de estabilizacao pos-lancamento com base em uso real

### Gate de saida

O produto entra em producao com rollback, observabilidade, suporte e confianca suficiente para iniciar a fase de estabilizacao.

---

## Trilhas continuas durante todo o roadmap

- manter testes de regressao do dominio como ativo central do projeto
- revisar toda feature sob a lente de tenancy, autorizacao e auditoria
- evitar colocar regra financeira oficial no frontend
- tratar importacao legada como requisito de produto, nao como script temporario esquecido
- documentar toda decisao estrutural em ADR curta
- medir performance do horizonte e das consultas agregadas antes de virar problema em producao
- incluir QA funcional e tecnico desde as primeiras sprints

## Ordem recomendada de execucao sem inversao

Algumas dependencias deste roadmap nao deveriam ser quebradas:

1. Nao iniciar modulos financeiros web sem identity, tenancy e schema multiusuario definidos.
2. Nao tratar o horizonte como problema de UI; o calculo oficial deve nascer no backend.
3. Nao empurrar importacao legada para o fim do projeto sem prova de conceito antecipada.
4. Nao deixar seguranca e LGPD apenas para a ultima sprint; o hardening final existe, mas a base precisa nascer correta.
5. Nao expandir analytics, chatbot ou features secundarias antes de fechar o nucleo financeiro e a migracao.

## Marco recomendado para a primeira release web

A primeira release web deve ser considerada pronta quando cumprir simultaneamente os seguintes pontos:

- usuario autentica com seguranca e acessa apenas seus proprios dados
- contas, lancamentos, horizonte, contratos, cartoes, parcelamentos e provisoes funcionam de ponta a ponta
- importacao do legado foi validada em base real controlada
- exportacao por usuario e trilha minima de auditoria estao operacionais
- ambiente de producao possui monitoramento, backup, rollback e suporte definidos

## Proxima camada apos a R1

Depois da estabilizacao da primeira release, o backlog natural passa a ser:

- refinamento de UX do horizonte web
- melhorias de analytics e visualizacoes
- categorias customizaveis, se forem validadas como necessidade real
- automacoes de onboarding e migracao self-service
- melhorias de produtividade operacional e reducao de suporte manual
- exploracao controlada de chatbot ou entrada por linguagem natural