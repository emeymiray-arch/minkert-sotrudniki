import { Briefcase, ChevronLeft } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';

export function OpsLayout() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-accent/20 text-accent">
            <Briefcase className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Контроль</h1>
            <p className="text-[13px] text-muted dark:text-white/50">Задачи для контроля процессов салона</p>
          </div>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stroke px-3 py-1.5 text-[13px] font-medium text-zinc-700 transition hover:bg-black/[0.04] dark:border-white/10 dark:text-white/80 dark:hover:bg-white/[0.05]"
        >
          <ChevronLeft className="size-4" />
          К Minkert
        </Link>
      </div>

      <Outlet />
    </div>
  );
}
