import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtUserPayload } from '../types/jwt-user';

interface JwtValidated {
  sub: string;
  email: string;
  role: UserRole;
  linkedEmployeeId?: string | null;
  linkedCrmMasterId?: string | null;
}

const USER_CACHE_TTL_MS = 60_000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly userCache = new Map<string, number>();

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtValidated): Promise<JwtUserPayload> {
    const now = Date.now();
    const cachedUntil = this.userCache.get(payload.sub);
    if (!cachedUntil || cachedUntil < now) {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });
      if (!user) {
        throw new UnauthorizedException('Сессия недействительна');
      }
      this.userCache.set(payload.sub, now + USER_CACHE_TTL_MS);
      if (this.userCache.size > 5000) {
        for (const [id, until] of this.userCache) {
          if (until < now) this.userCache.delete(id);
        }
      }
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      linkedEmployeeId: payload.linkedEmployeeId ?? null,
      linkedCrmMasterId: payload.linkedCrmMasterId ?? null,
    };
  }
}
