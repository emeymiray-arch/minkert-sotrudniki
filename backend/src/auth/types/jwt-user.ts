import { UserRole } from '@prisma/client';

export interface JwtUserPayload {
  sub: string;
  email: string;
  role: UserRole;
  /** Карточка сотрудника: сотрудник с ролью VIEWER может менять дни в задачах только этой карточки. */
  linkedEmployeeId?: string | null;
}
