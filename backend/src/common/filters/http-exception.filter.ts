import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class SafeHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string }>();

    const isProd = process.env.NODE_ENV === 'production';
    const requestId = req.requestId ?? 'n/a';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload =
        typeof body === 'string' ? { message: body }
        : body && typeof body === 'object' ? body
        : { message: exception.message };

      if (status >= 500) {
        this.logger.error(
          `[${requestId}] ${req.method} ${req.url} → ${status}`,
          isProd ? undefined : (exception as Error).stack,
        );
      }

      return res.status(status).json({
        ...payload,
        statusCode: status,
        requestId,
      });
    }

    this.logger.error(
      `[${requestId}] ${req.method} ${req.url} → 500`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isProd ? 'Внутренняя ошибка сервера' : (exception as Error)?.message ?? 'Error',
      requestId,
    });
  }
}
