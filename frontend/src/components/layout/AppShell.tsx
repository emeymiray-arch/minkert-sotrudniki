import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';
import { ChevronDown, LayoutDashboard, LineChart, LogOut, Menu, Settings2, Sparkles, Users2 } from 'lucide-react';
import * as React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/context/theme';
import { cnRoleRu } from '@/lib/format';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Обзор', icon: LayoutDashboard, end: true },
  { to: '/employees', label: 'Сотрудники', icon: Users2, end: false },
  { to: '/analytics', label: 'Аналитика', icon: LineChart, end: false },
  { to: '/settings', label: 'Настройки', icon: Settings2, end: false },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            end={item.end}
            to={item.to}
            onClick={() => onNavigate?.()}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 pl-3.5 text-[13px] font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-focus)/0.35)]',
                isActive ?
                  'bg-black/[0.06] text-zinc-900 dark:bg-white/[0.08] dark:text-white'
                : 'text-zinc-600 hover:bg-black/[0.04] hover:text-zinc-900 dark:text-white/55 dark:hover:bg-white/[0.05] dark:hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full transition-colors',
                    isActive ? 'bg-accent' : 'bg-transparent group-hover:bg-zinc-300 dark:group-hover:bg-white/25',
                  )}
                />
                <Icon className="size-[18px] shrink-0 opacity-80" aria-hidden />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children?: React.ReactNode }) {
  const { logout, user } = useAuth();
  const { mode, setMode } = useTheme();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const content = children ?? <Outlet />;

  return (
    <div className="flex min-h-full bg-[hsl(var(--bg))] bg-ambient">
      <motion.aside
        initial={false}
        animate={{ opacity: 1 }}
        className="fixed inset-y-0 left-0 z-40 hidden w-[256px] flex-col border-r border-stroke bg-[hsl(var(--sidebar))] shadow-sidebar dark:border-white/[0.06] lg:flex"
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-stroke px-5 dark:border-white/[0.06]">
          <div className="grid size-9 place-items-center rounded-lg bg-accent text-accent-fg shadow-sm">
            <Sparkles className="size-[18px]" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-white">Minkert</div>
            <div className="truncate text-[11px] text-muted dark:text-white/45">KPI и команда</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav />
        </div>

        <div className="border-t border-stroke p-4 dark:border-white/[0.06]">
          <div className="rounded-lg border border-stroke bg-black/[0.02] px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <div className="truncate text-[13px] font-medium text-zinc-900 dark:text-white">{user?.name ?? 'Гость'}</div>
            <div className="truncate text-[11px] text-muted dark:text-white/45">{cnRoleRu(user?.role ?? '—')}</div>
          </div>
        </div>
      </motion.aside>

      <div className="flex min-h-full flex-1 flex-col lg:pl-[256px]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-stroke bg-[hsl(var(--bg))]/90 px-4 backdrop-blur-md dark:border-white/[0.06] lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <Button variant="outline" size="icon" aria-label="Меню" className="shrink-0" onClick={() => setMobileOpen(true)}>
              <Menu className="size-5" />
            </Button>
            <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">Minkert</span>
          </div>

          <div className="hidden text-sm text-muted lg:block dark:text-white/45">Рабочее пространство</div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="sm" className="max-w-[200px] gap-2">
                <span className="truncate">{user?.name ?? 'Аккаунт'}</span>
                <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-[100] min-w-[220px] rounded-xl border border-stroke bg-[hsl(var(--panel))] p-1.5 shadow-xl dark:border-white/[0.08]"
                sideOffset={8}
                align="end"
              >
                <div className="px-2.5 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted dark:text-white/40">Роль</div>
                  <div className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{user?.role ?? '—'}</div>
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-stroke dark:bg-white/[0.06]" />
                <DropdownMenu.Item
                  className="cursor-pointer rounded-lg px-2.5 py-2 text-[13px] font-medium outline-none hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                  onSelect={() => setMode('dark')}
                >
                  Тёмная тема
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cursor-pointer rounded-lg px-2.5 py-2 text-[13px] font-medium outline-none hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                  onSelect={() => setMode('light')}
                >
                  Светлая тема
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cursor-pointer rounded-lg px-2.5 py-2 text-[13px] font-medium outline-none hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                  onSelect={() => setMode('system')}
                >
                  Как в системе {mode === 'system' ? '· активно' : ''}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-stroke dark:bg-white/[0.06]" />
                <DropdownMenu.Item
                  className="cursor-pointer rounded-lg px-2.5 py-2 text-[13px] font-semibold text-rose-600 outline-none hover:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/15"
                  onSelect={() => logout().catch(() => undefined)}
                >
                  <span className="flex items-center gap-2">
                    <LogOut className="size-4" />
                    Выйти
                  </span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </header>

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
            {content}
          </motion.div>
        </main>
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="max-w-sm border-stroke dark:border-white/[0.08]">
          <DialogTitle className="text-base font-semibold">Разделы</DialogTitle>
          <div className="mt-4 -mx-1">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
          <Button variant="outline" className="mt-6 w-full" onClick={() => logout().catch(() => undefined)}>
            Выйти
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
