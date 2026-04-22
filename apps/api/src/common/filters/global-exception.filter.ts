import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ErrorCodes } from '@motogram/shared';
import type { Response } from 'express';

// Spec 9.4 - Standart hata formati: { error: string, code: number }

interface ExceptionPayload {
  error?: string;
  code?: number;
  message?: string | string[];
  details?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      const payload: ExceptionPayload =
        typeof resp === 'object' && resp !== null ? (resp as ExceptionPayload) : { message: String(resp) };

      response.status(status).json({
        error: payload.error ?? this.inferError(status),
        code: payload.code ?? this.inferCode(status),
        ...(payload.details !== undefined ? { details: payload.details } : {}),
      });
      return;
    }

    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(err.message, err.stack);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'internal_server_error',
      code: ErrorCodes.INTERNAL,
    });
  }

  private inferError(status: number): string {
    switch (status) {
      case 400:
        return 'bad_request';
      case 401:
        return 'unauthorized';
      case 403:
        return 'forbidden';
      case 404:
        return 'not_found';
      case 409:
        return 'conflict';
      case 429:
        return 'rate_limited';
      default:
        return 'http_error';
    }
  }

  private inferCode(status: number): number {
    switch (status) {
      case 400:
        return ErrorCodes.VALIDATION_FAILED;
      case 401:
        return ErrorCodes.UNAUTHORIZED;
      case 403:
        return ErrorCodes.FORBIDDEN;
      case 404:
        return ErrorCodes.NOT_FOUND;
      case 409:
        return ErrorCodes.CONFLICT;
      case 429:
        return ErrorCodes.RATE_LIMITED;
      default:
        return ErrorCodes.INTERNAL;
    }
  }
}
