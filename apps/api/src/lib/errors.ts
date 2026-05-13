export type SerializedErrorBody = {
  code: string;
  details?: unknown;
  message: string;
  requestId: string;
};

export type SerializedErrorLog = {
  code?: string;
  message: string;
  name?: string;
  statusCode?: number;
};

const LOG_MESSAGE_REDACTIONS = [
  {
    pattern: /(postgres(?:ql)?:\/\/)([^@\s]+)@/gi,
    replacement: '$1[redacted]@',
  },
  {
    pattern: /(Bearer\s+)([^\s]+)/gi,
    replacement: '$1[redacted]',
  },
  {
    pattern:
      /\b(DATABASE_URL|SESSION_SECRET|BACKUP_ENCRYPTION_PASSPHRASE)\b(\s*[=:]\s*)([^\s,;]+)/gi,
    replacement: '$1$2[redacted]',
  },
] as const;

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function sanitizeLogMessage(message: string): string {
  return LOG_MESSAGE_REDACTIONS.reduce(
    (current, redaction) => current.replace(redaction.pattern, redaction.replacement),
    message,
  );
}

export function serializeError(
  error: unknown,
  requestId: string,
): { body: SerializedErrorBody; statusCode: number } {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        code: error.code,
        details: error.details,
        message: error.message,
        requestId,
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocorreu um erro interno inesperado.',
      requestId,
    },
  };
}

export function getErrorLogMessage(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeLogMessage(error.message);
  }

  return 'Erro nao identificado';
}

export function serializeErrorForLog(error: unknown): SerializedErrorLog {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: sanitizeLogMessage(error.message),
      name: error.name,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    return {
      message: sanitizeLogMessage(error.message),
      name: error.name,
    };
  }

  return {
    message: 'Erro nao identificado',
  };
}
