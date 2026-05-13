import { motion } from 'framer-motion';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim(), password);
      toast.success('Добро пожаловать');
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось войти';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-full flex-col bg-[hsl(var(--bg))] bg-ambient lg:flex-row">
      <div className="relative hidden flex-1 flex-col justify-between border-b border-stroke p-10 lg:flex lg:border-b-0 lg:border-r dark:border-white/[0.06]">
        <div className="text-sm font-semibold text-zinc-900 dark:text-white">Minkert</div>
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">Управление командой и KPI</h1>
          <p className="text-[15px] leading-relaxed text-muted dark:text-white/50">Единая панель для задач, эффективности и аналитики — без лишнего шума.</p>
        </div>
        <p className="text-xs text-muted dark:text-white/40">Демо: admin@minkert.local · Demo123!</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <div className="text-sm font-semibold text-zinc-900 dark:text-white">Minkert</div>
            <p className="mt-2 text-[13px] text-muted dark:text-white/45">Вход в рабочее пространство</p>
          </div>

          <Card className="p-8">
            <div className="space-y-1">
              <div className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Вход</div>
              <div className="text-[13px] text-muted dark:text-white/50">
                Демо: <span className="font-medium text-zinc-900 dark:text-white/90">admin@minkert.local</span> / Demo123!
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <label className="grid gap-1.5 text-[13px] font-medium text-zinc-800 dark:text-white/90">
                Email
                <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com" />
              </label>

              <label className="grid gap-1.5 text-[13px] font-medium text-zinc-800 dark:text-white/90">
                Пароль
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  type="password"
                  placeholder="••••••••"
                />
              </label>

              <Button disabled={busy} className="w-full" size="lg" type="submit">
                Продолжить
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
