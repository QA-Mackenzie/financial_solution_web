# Logging e Observabilidade Inicial

## Objetivo

Definir a linha minima de observabilidade adotada na Sprint 0 para a API da Economy Cash.

## Padrões

- logs estruturados emitidos pelo logger nativo do Fastify
- correlation id reaproveitado de x-correlation-id quando enviado pelo cliente ou gerado no backend
- resposta sempre devolve x-correlation-id para rastreamento cruzado
- erros retornam payload estavel com code, message e requestId

## Campos sensiveis mascarados

- req.headers.authorization
- req.headers.cookie
- req.headers.origin
- req.headers.referer
- req.body.password
- req.body.email
- req.body.token
- set-cookie de resposta

## Uso esperado

- frontend deve propagar o x-correlation-id em chamadas criticas quando necessario
- suporte e desenvolvimento usam requestId para localizar logs e reproduzir falhas
- novas rotas devem reaproveitar AppError para manter serializacao consistente

## Eventos de seguranca observaveis na Sprint 11

- SECURITY_CSRF_REJECTED para mutacoes bloqueadas por origem cruzada ou fetch metadata suspeito
- SECURITY_RATE_LIMIT_REJECTED para excesso de chamadas em login, recovery e leituras pesadas
- PRIVACY_REQUEST_CREATED para abertura do fluxo LGPD equivalente pelo proprio titular

## Endpoints operacionais

- /health retorna apenas o status minimo para o provedor de hospedagem
- /livez confirma que o processo HTTP esta vivo sem expor detalhes internos
- /readyz expande checks de banco, timestamp e uptime para troubleshooting operacional

## Retencao operacional

- o job apps/api/src/scripts/apply-retention.ts aplica a janela configurada para auth.audit_logs, sessoes expiradas/revogadas, tokens expirados/consumidos e solicitacoes LGPD resolvidas
- parametros de retencao sao controlados por AUTH_AUDIT_LOG_RETENTION_DAYS, SESSION_RETENTION_DAYS, TOKEN_RETENTION_DAYS e PRIVACY_REQUEST_RETENTION_DAYS
