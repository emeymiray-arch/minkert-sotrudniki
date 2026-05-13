import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtUserPayload } from '../types/jwt-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUserPayload => {
    const req = ctx.switchToHttp().getRequest<{ user: JwtUserPayload }>();
    return req.user;
  },
);
