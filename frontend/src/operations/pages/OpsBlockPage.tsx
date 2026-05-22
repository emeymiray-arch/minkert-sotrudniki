import { useLocation } from 'react-router-dom';

import { OpsTaskBoard } from '@/operations/components/OpsTaskBoard';
import type { OpsTimeBlock } from '@/operations/types';

const BLOCK_BY_SLUG: Record<string, { block: OpsTimeBlock; title: string; desc: string }> = {
  utro: { block: 'MORNING', title: 'Утро', desc: 'Открытие, подготовка, утренний контроль.' },
  den: { block: 'DAY', title: 'День', desc: 'Операционный цикл в часы пика.' },
  vecher: { block: 'EVENING', title: 'Вечер', desc: 'Закрытие смены, отчёты, передача.' },
  'sleduyushchiy-den': { block: 'NEXT_DAY', title: 'Следующий день', desc: 'Подготовка и проверка на завтра.' },
  nedelya: { block: 'WEEK', title: 'Неделя', desc: 'Недельные цели и обзор.' },
};

export default function OpsBlockPage() {
  const { pathname } = useLocation();
  const slug = pathname.split('/').filter(Boolean).pop() ?? 'utro';
  const cfg = BLOCK_BY_SLUG[slug] ?? BLOCK_BY_SLUG.utro!;
  return <OpsTaskBoard block={cfg.block} title={cfg.title} description={cfg.desc} />;
}
