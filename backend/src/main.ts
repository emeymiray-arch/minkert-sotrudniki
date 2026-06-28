import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { initSentryIfConfigured } from './common/sentry/init-sentry';
import { validateEnvOnStartup } from './common/startup/validate-env';

async function bootstrap() {
  initSentryIfConfigured();
  validateEnvOnStartup();

  const logger = new Logger('Bootstrap');
  const isProd = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule, {
    cors: false,
    bufferLogs: true,
  });

  const expressApp = app.getHttpAdapter().getInstance();
  if (expressApp?.set) {
    expressApp.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
  }

  app.use(requestIdMiddleware);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
      hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );

  const originsRaw = process.env.CORS_ORIGIN?.trim();
  if (isProd && !originsRaw) {
    logger.error(
      'CORS_ORIGIN не задан в production — API не примет запросы с фронта',
    );
  }
  app.enableCors({
    origin: originsRaw?.length
      ? originsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : isProd
        ? false
        : true,
    credentials: true,
  });

  app.setGlobalPrefix('api', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Minkert API')
    .setDescription('REST API платформы Minkert')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  logger.log(
    `API: http://localhost:${port}/api | docs: /api/docs | health: /api/health`,
  );
}

bootstrap().catch((err) => {
  /* eslint-disable no-console */
  console.error(err);
  process.exitCode = 1;
});
