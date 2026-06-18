import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  const users: jest.Mocked<Pick<UsersService, 'findByEmail' | 'countUsers' | 'registerUser'>> = {
    findByEmail: jest.fn(),
    countUsers: jest.fn(),
    registerUser: jest.fn(),
  };

  const prisma = {
    refreshToken: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  } as unknown as PrismaService;

  const jwt = { sign: jest.fn().mockReturnValue('access-token') } as unknown as JwtService;
  const config = {
    get: jest.fn((key: string) => (key === 'JWT_ACCESS_EXPIRES_SECONDS' ? '3600' : '14')),
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma, users as unknown as UsersService, jwt, config);
  });

  describe('registerBootstrap', () => {
    it('блокирует bootstrap в production без ALLOW_BOOTSTRAP', async () => {
      const prev = process.env.NODE_ENV;
      const prevAllow = process.env.ALLOW_BOOTSTRAP;
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_BOOTSTRAP;

      await expect(
        service.registerBootstrap({ email: 'a@b.c', password: 'x', name: 'Test' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      process.env.NODE_ENV = prev;
      if (prevAllow !== undefined) process.env.ALLOW_BOOTSTRAP = prevAllow;
    });
  });

  describe('login', () => {
    it('отклоняет неверный пароль', async () => {
      users.findByEmail.mockResolvedValue({
        id: '1',
        email: 'a@b.c',
        passwordHash: '$2b$10$invalidhashfortest',
        name: 'A',
        role: UserRole.ADMIN,
        linkedEmployeeId: null,
        linkedCrmMasterId: null,
        createdAt: new Date(),
      } as never);

      await expect(service.login('a@b.c', 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
