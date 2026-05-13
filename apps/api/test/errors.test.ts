import { describe, expect, it } from 'vitest';

import { REDACTED_LOG_PATHS } from '../src/app';
import {
  AppError,
  sanitizeLogMessage,
  serializeErrorForLog,
} from '../src/lib/errors';

describe('logging hardening', () => {
  it('mantem a lista de campos sensiveis redigidos', () => {
    expect(REDACTED_LOG_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers["x-api-key"]',
        'req.query.token',
        'req.body.password',
        'req.body.previewToken',
        'req.body.clientSecret',
        'res.headers["set-cookie"]',
      ]),
    );
  });

  it('sanitiza mensagens de erro com credenciais operacionais', () => {
    const sanitized = sanitizeLogMessage(
      'Falha ao conectar em postgres://user:super-secret@db.internal:5432/economy_cash com Bearer abc123 e SESSION_SECRET=minha-chave',
    );

    expect(sanitized).not.toContain('super-secret');
    expect(sanitized).not.toContain('abc123');
    expect(sanitized).not.toContain('minha-chave');
    expect(sanitized).toContain('postgres://[redacted]@db.internal:5432/economy_cash');
    expect(sanitized).toContain('Bearer [redacted]');
    expect(sanitized).toContain('SESSION_SECRET=[redacted]');
  });

  it('serializa AppError para log sem details arbitrarios', () => {
    const serialized = serializeErrorForLog(
      new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', {
        token: 'nao-deve-aparecer',
      }),
    );

    expect(serialized).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Dados invalidos.',
      name: 'Error',
      statusCode: 400,
    });
  });
});