import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp } from './helpers/e2e-app';

describe('Health check (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health доступен без авторизации и проверяет БД', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.ok).toBe(true);
        expect(res.body.db).toBe('up');
        expect(res.body.migrations).toBeDefined();
      });
  });

  it('GET /api/health/data — счётчики данных', () => {
    return request(app.getHttpServer())
      .get('/api/health/data')
      .expect(200)
      .expect((res) => {
        expect(res.body.ok).toBe(true);
        expect(res.body.data).toBeDefined();
        expect(typeof res.body.data.users).toBe('number');
      });
  });
});
