# Politica de Segredos e Configuracao

## Objetivo

Estabelecer a convencao minima de configuracao por ambiente da Economy Cash desde a Sprint 0.

## Convencoes

- arquivos .env.example documentam apenas nomes e valores de referencia local
- segredos reais nao entram no Git
- cada ambiente usa seu proprio conjunto de variaveis e rotacao independente
- valores sensiveis devem ser gerenciados por secret store do provedor de hospedagem quando houver deploy

## Segredos iniciais

- SESSION_SECRET
- DATABASE_URL
- BACKUP_ENCRYPTION_PASSPHRASE
- futuros tokens de email, backup, importacao e storage

## Rotacao

- SESSION_SECRET deve ser rotacionado por ambiente antes de producao
- DATABASE_URL deve apontar para credenciais especificas por ambiente
- BACKUP_ENCRYPTION_PASSPHRASE deve existir apenas no cofre operacional e trocar junto com o ciclo de backup/restore ensaiado
- credenciais vazadas invalidam o segredo imediatamente e exigem nova distribuicao

## Configuracao por ambiente

- desenvolvimento local: .env nao versionado baseado em .env.example
- staging: segredos isolados com base anonimizada ou controlada
- producao: segredos exclusivos, auditoria de acesso e historico de rotacao

## Parametros operacionais nao secretos

- rate limits e janelas de retencao devem ficar explicitos no provedor, mesmo quando houver default no codigo
- exemplos atuais: AUTH_RATE_LIMIT_MAX, EXPENSIVE_READ_RATE_LIMIT_MAX, SESSION_ABSOLUTE_TTL_HOURS, AUTH_AUDIT_LOG_RETENTION_DAYS e PRIVACY_REQUEST_RETENTION_DAYS
