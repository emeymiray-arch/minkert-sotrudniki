import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidation');

export function validateEnvOnStartup(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.DATABASE_URL?.trim()) {
    errors.push('DATABASE_URL не задан');
  }

  if (!process.env.JWT_ACCESS_SECRET?.trim()) {
    errors.push('JWT_ACCESS_SECRET не задан');
  } else if (process.env.JWT_ACCESS_SECRET.length < 32) {
    warnings.push(
      'JWT_ACCESS_SECRET короче 32 символов — сгенерируйте: openssl rand -hex 32',
    );
  }

  if (isProd && !process.env.CORS_ORIGIN?.trim()) {
    errors.push('CORS_ORIGIN не задан в production');
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (
    !isTest &&
    isProd &&
    dbUrl.includes('neon.tech') &&
    !dbUrl.includes('-pooler')
  ) {
    warnings.push(
      'Neon: рекомендуется pooled URL (hostname с -pooler) для стабильности при нагрузке',
    );
  }

  for (const w of warnings) logger.warn(w);
  if (errors.length) {
    for (const e of errors) logger.error(e);
    throw new Error(`Конфигурация невалидна: ${errors.join('; ')}`);
  }

  logger.log(`Окружение проверено (prod=${isProd})`);
}
