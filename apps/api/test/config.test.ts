import { describe, expect, it } from 'vitest';

import { parseEnv } from '../src/config';

describe('environment configuration', () => {
  it('mantem defaults de desenvolvimento fora de producao', () => {
    const env = parseEnv({ NODE_ENV: 'development' });

    expect(env.DATABASE_URL).toBe('postgres://postgres:postgres@localhost:5432/economy_cash');
    expect(env.SESSION_SECRET).toBe('change-me-in-local-dev');
    expect(env.WEB_ORIGIN).toBe('http://localhost:5173');
  });

  it('falha em producao sem variaveis explicitas de seguranca', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(
      'Configuracao insegura para producao:',
    );
  });

  it('falha em producao com origem insegura e segredo curto', () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: 'postgres://user:password@db.internal:5432/economy_cash',
        NODE_ENV: 'production',
        SESSION_SECRET: 'segredo-curto-produ',
        WEB_ORIGIN: 'http://app.example.com',
      }),
    ).toThrow('SESSION_SECRET deve ter ao menos 32 caracteres em producao.');
  });

  it('aceita producao quando os valores sensiveis sao explicitos e fortes', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgres://user:password@db.internal:5432/economy_cash',
      NODE_ENV: 'production',
      SESSION_SECRET: 'uma-chave-bem-maior-que-trinta-e-dois-caracteres',
      WEB_ORIGIN: 'https://app.example.com',
    });

    expect(env.NODE_ENV).toBe('production');
    expect(env.WEB_ORIGIN).toBe('https://app.example.com');
  });
});