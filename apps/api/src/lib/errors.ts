export type SerializedErrorBody = {
  code: string;
  details?: unknown;
  message: string;
  requestId: string;
};

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
    return error.message;
  }

  return 'Erro nao identificado';
}
