import type { UserRole } from '@/lib/types';

/** Стартовая страница после входа по роли. */
export function homePathForRole(role?: UserRole | string): string {
  if (role === 'LOYALTY' || role === 'MASTER' || role === 'MANAGER') return '/crm';
  return '/';
}

function roleAllowsPath(pathname: string, allowed: string[]): boolean {
  return allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Разрешённые пути для менеджера салона. */
export function isManagerPath(pathname: string): boolean {
  return roleAllowsPath(pathname, ['/', '/crm', '/loyalty', '/finansy', '/settings']);
}

/** Разрешённые пути для мастера (CRM + уведомления). */
export function isMasterPath(pathname: string): boolean {
  return roleAllowsPath(pathname, ['/crm', '/settings']);
}
