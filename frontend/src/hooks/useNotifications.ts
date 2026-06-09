import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { useAuth } from '@/context/auth';
import { apiJson } from '@/lib/http';

type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
};

function playChime() {
  try {
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02 + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35 + i * 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + 0.4 + i * 0.08);
    });
  } catch {
    /* audio unavailable */
  }
}

export function useNotifications() {
  const { user, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const seenRef = React.useRef<Set<string>>(new Set());
  const primedRef = React.useRef(false);
  const [visible, setVisible] = React.useState(() => typeof document !== 'undefined' && document.visibilityState === 'visible');

  React.useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const q = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => apiJson<AppNotification[]>('/notifications'),
    enabled: isAuthenticated && !!user && visible && ['ADMIN', 'MANAGER', 'MASTER'].includes(user.role),
    refetchInterval: visible ? 45_000 : false,
    staleTime: 30_000,
  });

  React.useEffect(() => {
    if (!q.data) return;
    if (!primedRef.current) {
      q.data.forEach((n) => seenRef.current.add(n.id));
      primedRef.current = true;
      return;
    }
    const fresh = q.data.filter((n) => !seenRef.current.has(n.id));
    if (fresh.length) {
      fresh.forEach((n) => seenRef.current.add(n.id));
      playChime();
      const ids = fresh.map((n) => n.id);
      apiJson('/notifications/read', { method: 'PATCH', body: JSON.stringify({ ids }) })
        .then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))
        .catch(() => undefined);
    }
  }, [q.data, qc]);

  return q;
}
