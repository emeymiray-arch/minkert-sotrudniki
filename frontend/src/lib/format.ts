import type { EmployeeStatus } from '@/lib/types';

export function ruEmployeeStatus(status: EmployeeStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Активен';
    case 'INACTIVE':
      return 'Неактивен';
    case 'ON_LEAVE':
      return 'Отпуск / отсутствие';
    default:
      return status;
  }
}

export function cnRoleRu(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'Администратор';
    case 'MANAGER':
      return 'Менеджер';
    case 'VIEWER':
      return 'Только просмотр';
    default:
      return role;
  }
}
