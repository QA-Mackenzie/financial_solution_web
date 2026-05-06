# Threat Model Inicial - Sprint 0

## Escopo

- login e cadastro
- sessao em cookie
- dados financeiros futuros por usuario
- exportacoes e backups futuros

## Ativos principais

- credenciais do usuario
- identificador de sessao
- dados financeiros pessoais
- logs e trilhas de auditoria
- arquivos exportados e backups

## Ameacas principais

- vazamento de credenciais por logs ou configuracao insegura
- sequestro de sessao por cookie mal configurado
- acesso indevido entre usuarios por falha de tenancy ou autorizacao
- exposicao de segredos por versionamento incorreto
- exportacoes futuras sem protecao adequada de ownership

## Mitigacoes ja adotadas na Sprint 0

- cookie HttpOnly como base da estrategia de sessao
- correlation id e resposta padronizada para observabilidade sem expor stack traces
- redacao de campos sensiveis em logs da API
- separacao entre frontend, backend e banco
- politica explicita de que Solucao_Financeira e somente leitura para consulta

## Mitigacoes planejadas nas proximas sprints

- persistencia segura de sessao
- hashing forte de senha
- CSRF protection
- owner-based authorization com user_id em toda entidade
- auditoria e monitoramento de eventos sensiveis
