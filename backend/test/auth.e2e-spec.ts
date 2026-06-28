import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createE2eApp } from './helpers/e2e-app';

const TEST_ADMIN = {
  email: 'e2e-admin@minkert.test',
  password: 'E2eTestPass123!',
  name: 'E2E Admin',
};

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    const hash = await bcrypt.hash(TEST_ADMIN.password, 10);
    await prisma.user.upsert({
      where: { email: TEST_ADMIN.email },
      create: {
        email: TEST_ADMIN.email,
        passwordHash: hash,
        name: TEST_ADMIN.name,
        role: UserRole.ADMIN,
      },
      update: { passwordHash: hash, role: UserRole.ADMIN },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_ADMIN.email } });
    await app.close();
  });

  it('POST /api/auth/login — успешный вход', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe(TEST_ADMIN.email);
  });

  it('POST /api/auth/login — неверный пароль', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: 'wrong' })
      .expect(401);
  });

  it('POST /api/auth/refresh — ротация токена', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });

    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(201);

    expect(res.body.tokens.accessToken).toBeDefined();
    expect(res.body.tokens.refreshToken).toBeDefined();
  });

  it('GET /api/crm/clients — доступ с JWT', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });

    const res = await request(app.getHttpServer())
      .get('/api/crm/clients?page=1&limit=10')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(res.body.items).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/crm/clients — без токена 401', () => {
    return request(app.getHttpServer()).get('/api/crm/clients').expect(401);
  });
});
