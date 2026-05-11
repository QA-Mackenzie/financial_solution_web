# Backup criptografado e restauracao

## Objetivo

Definir um runbook simples e reproduzivel para exportar o PostgreSQL com criptografia em repouso fora da aplicacao e restaurar de forma controlada.

## Premissas

- o dump sai do banco gerenciado, nao da aplicacao web
- a chave de criptografia fica fora do repositorio, em cofre operacional, como BACKUP_ENCRYPTION_PASSPHRASE
- todo restore deve ocorrer primeiro em staging ou ambiente isolado

## Backup completo criptografado

Exemplo com pg_dump custom format e OpenSSL:

```powershell
pg_dump "$env:DATABASE_URL" --format=custom --no-owner --no-privileges |
  openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_PASSPHRASE |
  Set-Content "backup-$(Get-Date -Format yyyyMMdd-HHmmss).dump.enc" -Encoding Byte
```

## Restore validado

```powershell
Get-Content "backup-20260511-010000.dump.enc" -Encoding Byte |
  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE |
  pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$env:STAGING_DATABASE_URL"
```

## Checklist do restore

1. restaurar primeiro em staging isolado
2. executar /health e /readyz apos o restore
3. rodar o job de retencao se o ambiente restaurado ficar acessivel por mais de uma janela operacional
4. validar login, horizonte e analytics com uma conta de smoke test
5. registrar horario, origem do dump e operador responsavel

## Frequencia minima sugerida

- backup completo diario
- teste de restore pelo menos quinzenal em staging
- rotacao da passphrase alinhada ao ensaio de restore e a qualquer incidente operacional