import type { AuthUser } from '@/lib/types';

/** Менять баллы по дням в задачах: руководство — у любого сотрудника; VIEWER — только у своей привязанной карточки. */
export function canEditTaskDays(user: AuthUser | null | undefined, employeeId: string): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'MANAGER') return true;
  if (user.role === 'VIEWER') {
    return Boolean(user.linkedEmployeeId && user.linkedEmployeeId === employeeId);
  }
  return false;
}
