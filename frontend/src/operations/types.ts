export type OpsTimeBlock = 'MORNING' | 'DAY' | 'EVENING' | 'NEXT_DAY' | 'WEEK';

export type OpsTaskStatus =
  | 'PENDING'
  | 'DONE'
  | 'NOT_DONE'
  | 'PARTIAL'
  | 'OVERDUE'
  | 'NEEDS_ATTENTION';

export type OpsViolationType =
  | 'LATE'
  | 'LEFT_WORKPLACE'
  | 'NO_WARNING'
  | 'MISSED_REPORT'
  | 'IGNORED_TASK'
  | 'REPEAT'
  | 'OTHER';

export type OpsBlockConfig = {
  id: string;
  block: OpsTimeBlock;
  title: string;
  timeStart: string;
  timeEnd: string;
  sortOrder: number;
  enabled: boolean;
};

export type OpsCategory = {
  id: string;
  title: string;
  sortOrder: number;
  pinned: boolean;
  taskCount: number;
  tasks: OpsTask[];
};

export type OpsBoard = {
  forDate: string;
  anchorDate: string;
  block: OpsTimeBlock;
  categories: OpsCategory[];
  uncategorized: OpsTask[];
};

export type OpsTaskCheckType = 'NONE' | 'ATTENDANCE' | 'CHECKLIST' | 'REPORT' | 'GENERIC';

export type OpsAttendanceMark = 'PRESENT' | 'LATE' | 'ABSENT' | 'WARNED';

export type OpsCheckJournalMeta = {
  recordDate: string;
  activeEmployees: number;
  recorded: number;
  issues: number;
};

export type OpsTaskCheckEntry = {
  id: string;
  employeeId: string;
  recordDate: string;
  attendanceMark?: OpsAttendanceMark | null;
  checklistOpened?: boolean | null;
  checklistDone?: boolean | null;
  checklistIgnored?: boolean | null;
  reportSubmitted?: boolean | null;
  reportError?: boolean | null;
  reportNeedsFix?: boolean | null;
  comment: string;
  extraNote: string;
  flagViolation: boolean;
};

export type OpsCheckSheet = {
  task: { id: string; title: string; status: OpsTaskStatus; checkType: OpsTaskCheckType; forDate: string };
  recordDate: string;
  rows: Array<{
    employee: { id: string; name: string; position: string };
    entry: OpsTaskCheckEntry | null;
  }>;
};

export type OpsTask = {
  id: string;
  block: OpsTimeBlock;
  categoryId?: string | null;
  checkType?: OpsTaskCheckType;
  checkJournal?: OpsCheckJournalMeta;
  title: string;
  description: string;
  sortOrder: number;
  forDate: string;
  dueAt: string | null;
  status: OpsTaskStatus;
  pinned: boolean;
  recurring: boolean;
  templateKey: string | null;
  assigneeId: string | null;
  markedAt: string | null;
  markedByName: string | null;
  assignee?: { id: string; name: string; position?: string } | null;
  comments?: { id: string; authorName: string; body: string; createdAt: string }[];
  notes?: { id: string; body: string; createdAt: string }[];
};

export type OpsDashboard = {
  forDate: string;
  stats: {
    total: number;
    done: number;
    notDone: number;
    overdue: number;
    needsAttention: number;
    completionPercent: number;
  };
  urgentTasks: OpsTask[];
  violationsToday: Array<{ id: string; description: string; employee: { id: string; name: string } }>;
  missedReports: Array<{ id: string; formKey: string; employee?: { id: string; name: string } | null }>;
  recentComments: Array<{ id: string; body: string; authorName: string; task: { id: string; title: string } }>;
  recentActivity: Array<{ id: string; action: string; entityType: string; userName: string; createdAt: string }>;
  repeatViolators: Array<{ id: string; name: string }>;
};

export const OPS_STATUS_LABELS: Record<OpsTaskStatus, string> = {
  PENDING: 'Ожидает',
  DONE: 'Сделано',
  NOT_DONE: 'Не сделано',
  PARTIAL: 'Частично',
  OVERDUE: 'Просрочено',
  NEEDS_ATTENTION: 'Требует внимания',
};

export const OPS_VIOLATION_LABELS: Record<OpsViolationType, string> = {
  LATE: 'Опоздание',
  LEFT_WORKPLACE: 'Уход с рабочего места',
  NO_WARNING: 'Без предупреждения',
  MISSED_REPORT: 'Пропущен отчёт',
  IGNORED_TASK: 'Игнор задачи',
  REPEAT: 'Повторное',
  OTHER: 'Другое',
};
