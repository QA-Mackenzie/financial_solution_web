# Logging e Observabilidade Inicial

## Objetivo

Definir a linha minima de observabilidade adotada na Sprint 0 para a API da SHF Web.

## Padrões

- logs estruturados emitidos pelo logger nativo do Fastify
- correlation id reaproveitado de x-correlation-id quando enviado pelo cliente ou gerado no backend
- resposta sempre devolve x-correlation-id para rastreamento cruzado
- erros retornam payload estavel com code, message e requestId

## Campos sensiveis mascarados

- req.headers.authorization
- req.headers.cookie
- req.body.password
- set-cookie de resposta

## Uso esperado

- frontend deve propagar o x-correlation-id em chamadas criticas quando necessario
- suporte e desenvolvimento usam requestId para localizar logs e reproduzir falhas
- novas rotas devem reaproveitar AppError para manter serializacao consistente
