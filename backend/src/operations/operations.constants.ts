import { OpsTimeBlock } from '@prisma/client';

export const OPS_DEFAULT_BLOCKS: Array<{
  block: OpsTimeBlock;
  title: string;
  timeStart: string;
  timeEnd: string;
  sortOrder: number;
}> = [
  { block: OpsTimeBlock.MORNING, title: 'Утро', timeStart: '08:00', timeEnd: '12:00', sortOrder: 0 },
  { block: OpsTimeBlock.DAY, title: 'День', timeStart: '12:00', timeEnd: '18:00', sortOrder: 1 },
  { block: OpsTimeBlock.EVENING, title: 'Вечер', timeStart: '18:00', timeEnd: '22:00', sortOrder: 2 },
  {
    block: OpsTimeBlock.NEXT_DAY,
    title: 'Следующий день',
    timeStart: '22:00',
    timeEnd: '23:59',
    sortOrder: 3,
  },
  { block: OpsTimeBlock.WEEK, title: 'Неделя', timeStart: '00:00', timeEnd: '23:59', sortOrder: 4 },
];

export const OPS_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Ожидает',
  DONE: 'Сделано',
  NOT_DONE: 'Не сделано',
  PARTIAL: 'Частично',
  OVERDUE: 'Просрочено',
  NEEDS_ATTENTION: 'Требует внимания',
};
