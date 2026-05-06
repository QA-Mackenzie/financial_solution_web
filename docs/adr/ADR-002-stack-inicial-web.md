# ADR-002 - Stack inicial da plataforma web

## Status

Aceito

## Contexto

O roadmap define a necessidade de autenticacao, tenancy, API oficial, frontend web e banco relacional desde o inicio. A stack precisa suportar evolucao incremental sem herdar decisoes do desktop.

## Decisao

Adotar a seguinte stack inicial:

- React + Vite no frontend
- React Router, TanStack Query, React Hook Form e Zod na interface
- Node.js + Fastify no backend
- PostgreSQL como banco de dados alvo
- cookies HttpOnly como base da estrategia de sessao
- Docker Compose para ambiente local minimo com PostgreSQL

## Consequencias

- a Sprint 0 entrega shell funcional, API inicial e infraestrutura local
- autenticacao persistente em banco, tenancy e autorizacao owner-based entram nas proximas sprints
- a API e o frontend podem evoluir separadamente sem depender de preload, IPC ou SQLite local
