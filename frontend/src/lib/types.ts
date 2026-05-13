export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';

export type UserRole = 'ADMIN' | 'MANAGER' | 'VIEWER';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** Карточка сотрудника: при роли VIEWER можно менять дни в задачах только у этой карточки. */
  linkedEmployeeId?: string | null;
};

export type Employee = {
  id: string;
  name: string;
  position: string;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number };
};

export type EmployeeListItem = Employee & {
  kpiWeekly?: number;
  kpiWeeklyRounded?: number;
  weekdayMetrics?: { label: string; efficiency: number }[];
};

export type Task = {
  id: string;
  employeeId: string;
  title: string;
  description: string;
  taskDate: string;
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat: number;
  sun: number;
};

export type TeamDashboard = {
  anchor: string;
  teamAvgEfficiency: number;
  weekOverWeekTrend: number;
  best: { employeeId: string; weeklyEfficiency: number }[];
  atRiskEmployees: { employeeId: string; weeklyEfficiency: number }[];
  lowPerformingTasks: {
    id: string;
    employeeName: string;
    title: string;
    weeklyEfficiency: number;
  }[];
};

export type HeatmapRow = {
  employeeId: string;
  name: string;
  cells: { key: string; label: string; value: number }[];
};
