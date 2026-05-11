# Monitoramento e alertas da Sprint 11

## Objetivo

Consolidar o baseline operacional para expor a Economy Cash a usuarios reais com visibilidade minima sobre disponibilidade, abuso e degradacao.

## Endpoints e sinais

- /health para health check externo do provedor
- /livez para liveness do processo HTTP
- /readyz para readiness detalhado com banco, timestamp e uptime
- x-correlation-id em todas as respostas para rastreamento cruzado
- auth.audit_logs para eventos de seguranca e atendimento LGPD

## Alertas recomendados

- /health diferente de 200 por mais de 2 verificacoes consecutivas
- /readyz com status degraded ou latencia de banco acima do limiar operacional do ambiente
- aumento anormal de SECURITY_RATE_LIMIT_REJECTED em login ou password recovery
- repeticao de SECURITY_CSRF_REJECTED indicando origem indevida ou automacao externa
- erro 5xx sustentado em /api/v1/horizon ou /api/v1/analytics

## Dashboards minimos

- disponibilidade: health, livez, readyz e 5xx por rota
- seguranca: AUTH_LOGIN_FAILURE, SECURITY_RATE_LIMIT_REJECTED, SECURITY_CSRF_REJECTED e PRIVACY_REQUEST_CREATED
- produto pesado: latencia de auth-login, horizon-read e analytics-read comparada ao benchmark da sprint 11

## Benchmark de referencia da sprint 11

- auth-login: average 42.50 ms, p95 44.96 ms, max 44.96 ms
- horizon-read: average 1.28 ms, p95 1.58 ms, max 1.73 ms
- analytics-read: average 7.94 ms, p95 12.04 ms, max 15.55 ms

## Acoes operacionais imediatas

1. revisar os rate limits do ambiente antes de abrir o staging para homologacao forte
2. agendar o job npm run retention:apply --workspace @economy-cash/api em rotina operacional
3. manter o correlation id no atendimento de incidentes e nas validacoes de restore