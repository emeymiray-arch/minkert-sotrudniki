import { cn } from '@/lib/utils';
import { clampTaskScore, type TaskScore } from '@/lib/task-days';

/**
 * Яркая заливка «как оценки в Дневник.ру»: красный (неуд), жёлто-оранжевый (удовл.), зелёный (хорошо).
 * Плотные material-похожие цвета, без пастели и без неона.
 */
const scoreCell: Record<TaskScore, string> = {
  0: 'border-2 border-[#b71c1c] bg-[#e53935] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
  1: 'border-2 border-[#f57c00] bg-[#ffca28] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]',
  2: 'border-2 border-[#1b5e20] bg-[#43a047] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
};

const scoreHover: Record<TaskScore, string> = {
  0: 'hover:bg-[#ef5350] hover:border-[#c62828]',
  1: 'hover:bg-[#ffd54f] hover:border-[#ef6c00]',
  2: 'hover:bg-[#4caf50] hover:border-[#2e7d32]',
};

/** Текст поверх заливки: белый на красном/зелёном, тёмно-коричневый на жёлтом. */
const ink: Record<TaskScore, string> = {
  0: 'text-white [text-shadow:0_1px_0_rgba(0,0,0,0.25)]',
  1: 'text-[#3e2723]',
  2: 'text-white [text-shadow:0_1px_0_rgba(0,0,0,0.25)]',
};

type Props = {
  weekdayShort: string;
  value: unknown;
  disabled?: boolean;
  compact?: boolean;
  /** День в шапке таблицы — в ячейке только цифра. */
  scoreOnly?: boolean;
  /** Ровная ячейка 56×56 как в шапке недельной матрицы. */
  matrix?: boolean;
  onStep: () => void;
};

export function TaskDayScoreCell({
  weekdayShort,
  value,
  disabled = false,
  compact = false,
  scoreOnly = false,
  matrix = false,
  onStep,
}: Props) {
  const v = clampTaskScore(value);
  const pad = matrix
    ? 'p-1.5'
    : scoreOnly
      ? compact
        ? 'p-1'
        : 'p-2'
      : compact
        ? 'px-1.5 py-2'
        : 'px-2 py-3';
  const labelCls = compact ? 'text-[8px] font-bold' : 'text-[10px] font-bold';
  const digitCls =
    matrix && scoreOnly
      ? 'text-lg font-black tabular-nums leading-none'
      : scoreOnly
        ? compact
          ? 'text-lg font-black tabular-nums'
          : 'text-2xl font-black tabular-nums'
        : compact
          ? 'text-xl font-black tabular-nums'
          : 'text-2xl font-black tabular-nums';
  const t = ink[v];

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${weekdayShort}, балл ${v}. Нажмите, чтобы переключить по кругу 0, 1, 2.`}
      onClick={() => {
        if (!disabled) onStep();
      }}
      className={cn(
        'flex w-full flex-col items-center justify-center font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-focus)/0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]',
        matrix ? 'h-14 shrink-0 rounded-lg' : ['rounded-xl', scoreOnly && !compact && 'min-h-[48px]'],
        pad,
        scoreCell[v],
        !disabled && ['cursor-pointer', scoreHover[v], 'active:scale-[0.97]'],
        disabled && 'cursor-default opacity-50',
      )}
    >
      {!scoreOnly ?
        <span className={cn('uppercase tracking-[0.12em]', labelCls, t)}>{weekdayShort}</span>
      : null}
      <span className={cn(scoreOnly ? '' : 'mt-0.5', 'leading-none', digitCls, t)}>{v}</span>
    </button>
  );
}
