import {
  OpsAttendanceMark,
  OpsTaskCheckType,
  OpsViolationType,
} from '@prisma/client';

export function inferCheckTypeFromTitle(title: string): OpsTaskCheckType {
  const t = title.toLowerCase();
  if (/явк|опозд|приход|пришл|отсутств/.test(t))
    return OpsTaskCheckType.ATTENDANCE;
  if (/чек|checklist|чек-лист/.test(t)) return OpsTaskCheckType.CHECKLIST;
  if (/отчёт|отчет|forms|google/.test(t)) return OpsTaskCheckType.REPORT;
  if (/провер|контрол|фикс/.test(t)) return OpsTaskCheckType.GENERIC;
  return OpsTaskCheckType.GENERIC;
}

type EntryLike = {
  attendanceMark?: OpsAttendanceMark | null;
  checklistOpened?: boolean | null;
  checklistDone?: boolean | null;
  checklistIgnored?: boolean | null;
  reportSubmitted?: boolean | null;
  reportError?: boolean | null;
  reportNeedsFix?: boolean | null;
  comment?: string | null;
  extraNote?: string | null;
};

export function checkEntryHasStoredData(entry: EntryLike): boolean {
  return (
    entry.attendanceMark != null ||
    entry.checklistOpened != null ||
    entry.checklistDone != null ||
    entry.checklistIgnored != null ||
    entry.reportSubmitted != null ||
    entry.reportError != null ||
    entry.reportNeedsFix != null ||
    (entry.comment?.trim()?.length ?? 0) > 0 ||
    (entry.extraNote?.trim()?.length ?? 0) > 0
  );
}

export function checkEntryHasIssue(
  entry: EntryLike,
  checkType: OpsTaskCheckType,
): boolean {
  switch (checkType) {
    case OpsTaskCheckType.ATTENDANCE:
      return (
        entry.attendanceMark === OpsAttendanceMark.LATE ||
        entry.attendanceMark === OpsAttendanceMark.ABSENT
      );
    case OpsTaskCheckType.CHECKLIST:
      return entry.checklistIgnored === true || entry.checklistOpened === false;
    case OpsTaskCheckType.REPORT:
      return (
        entry.reportSubmitted === false ||
        entry.reportError === true ||
        entry.reportNeedsFix === true
      );
    default:
      return false;
  }
}

export function violationFromCheckEntry(
  entry: EntryLike,
  checkType: OpsTaskCheckType,
): { type: OpsViolationType; description: string } | null {
  if (checkType === OpsTaskCheckType.ATTENDANCE) {
    if (entry.attendanceMark === OpsAttendanceMark.LATE) {
      return {
        type: OpsViolationType.LATE,
        description: 'Опоздание (журнал явки)',
      };
    }
    if (entry.attendanceMark === OpsAttendanceMark.ABSENT) {
      return {
        type: OpsViolationType.OTHER,
        description: 'Отсутствие (журнал явки)',
      };
    }
  }
  if (checkType === OpsTaskCheckType.CHECKLIST && entry.checklistIgnored) {
    return {
      type: OpsViolationType.IGNORED_TASK,
      description: 'Игнор чек-листа',
    };
  }
  if (
    checkType === OpsTaskCheckType.CHECKLIST &&
    entry.checklistOpened === false
  ) {
    return {
      type: OpsViolationType.IGNORED_TASK,
      description: 'Не открыл чек-лист',
    };
  }
  if (
    checkType === OpsTaskCheckType.REPORT &&
    entry.reportSubmitted === false
  ) {
    return {
      type: OpsViolationType.MISSED_REPORT,
      description: 'Отчёт не сдан',
    };
  }
  if (checkType === OpsTaskCheckType.REPORT && entry.reportError) {
    return {
      type: OpsViolationType.MISSED_REPORT,
      description: 'Ошибка в отчёте',
    };
  }
  return null;
}
