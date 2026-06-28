import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  private readonly slowMs = Number(process.env.SLOW_REQUEST_MS ?? 500);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { requestId?: string }>();
    const res = context.switchToHttp().getResponse<Response>();
    const started = Date.now();
    const requestId = req.requestId ?? 'n/a';
    const path = req.originalUrl ?? req.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started;
          const line = {
            requestId,
            method: req.method,
            path,
            status: res.statusCode,
            ms,
          };
          if (ms >= this.slowMs) {
            this.logger.warn(JSON.stringify({ ...line, slow: true }));
          } else if (process.env.HTTP_LOG_VERBOSE === '1') {
            this.logger.log(JSON.stringify(line));
          }
        },
        error: (err: Error) => {
          const ms = Date.now() - started;
          this.logger.warn(
            JSON.stringify({
              requestId,
              method: req.method,
              path,
              ms,
              error: err.message,
            }),
          );
        },
      }),
    );
  }
}
