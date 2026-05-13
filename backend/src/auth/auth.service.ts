import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomRefreshToken, sha256 } from '../common/crypto/hash';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUserPayload } from './types/jwt-user';
import { UsersService } from '../users/users.service';

export interface AuthTokenPair {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private accessExpirySeconds(): number {
    return Number(this.config.get<string>('JWT_ACCESS_EXPIRES_SECONDS') ?? 3600);
  }

  private refreshExpiryDays(): number {
    return Number(this.config.get<string>('JWT_REFRESH_EXPIRES_DAYS') ?? 14);
  }

  private signAccess(payload: JwtUserPayload): string {
    return this.jwt.sign(payload, {
      expiresIn: this.accessExpirySeconds(),
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  private async persistRefresh(userId: string, rawRefresh: string) {
    const tokenSha256 = sha256(rawRefresh);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshExpiryDays());
    await this.prisma.refreshToken.create({
      data: { userId, tokenSha256, expiresAt },
    });
    return expiresAt;
  }

  async issueTokens(user: { id: string; email: string; role: UserRole }): Promise<AuthTokenPair> {
    const payload: JwtUserPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.signAccess(payload);
    const rawRefresh = randomRefreshToken();
    await this.persistRefresh(user.id, rawRefresh);
    return {
      accessToken,
      expiresInSeconds: this.accessExpirySeconds(),
      refreshToken: rawRefresh,
    };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Неверный email или пароль');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Неверный email или пароль');
    const tokens = await this.issueTokens(user);
    return {
      tokens,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async logout(refreshToken: string): Promise<{ revoked: boolean }> {
    const tokenSha256 = sha256(refreshToken);
    const res = await this.prisma.refreshToken.deleteMany({ where: { tokenSha256 } });
    return { revoked: res.count > 0 };
  }

  async refresh(refreshToken: string) {
    const tokenSha256 = sha256(refreshToken);
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenSha256 },
      include: { user: true },
    });
    if (!row || row.expiresAt <= new Date()) {
      await this.prisma.refreshToken.deleteMany({ where: { tokenSha256 } });
      throw new UnauthorizedException('Сессия истекла или недействительна');
    }
    await this.prisma.refreshToken.delete({ where: { id: row.id } });
    const u = row.user;
    return this.issueTokens({
      id: u.id,
      email: u.email,
      role: u.role,
    });
  }

  /** Только когда в базе нет пользователей — создаётся первый ADMIN для bootstrap. */
  async registerBootstrap(dto: { email: string; password: string; name: string }) {
    const count = await this.users.countUsers();
    if (count > 0) {
      throw new ForbiddenException(
        'Публичная регистрация отключена. Войдите под учётной записью или используйте сид данных.',
      );
    }
    const user = await this.users.registerUser(dto.email, dto.password, dto.name, UserRole.ADMIN);
    const tokens = await this.issueTokens(user);
    return {
      tokens,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async registerAdmin(dto: { email: string; password: string; name: string; role: UserRole }) {
    const user = await this.users.registerUser(dto.email, dto.password, dto.name, dto.role ?? UserRole.VIEWER);
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }
}
