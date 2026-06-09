import type { UserRole } from '@/lib/types';

/** Стартовая страница после входа по роли. */
export function homePathForRole(role?: UserRole | string): string {
  if (role === 'LOYALTY' || role === 'MASTER' || role === 'MANAGER') return '/crm';
  return '/';
}

/** Разрешённые пути для менеджера салона. */
export function isManagerPath(pathname: string): boolean {
  const allowed = ['/', '/crm', '/loyalty', '/finansy'];
  return allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
