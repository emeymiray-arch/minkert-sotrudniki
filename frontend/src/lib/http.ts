import {
  clearAuthBundle,
  getAccessToken,
  getRefreshToken,
  readStoredUser,
  setAuthBundle,
} from '@/lib/storage';
import type { AuthUser } from '@/lib/types';

function isLocalPage(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

/**
 * База API: в `npm run dev` без `VITE_API_DIRECT` — `/api` (прокси Vite → :3000).
 * На проде по умолчанию `/api` (на Vercel — `middleware.ts` в корне репо или в `frontend/` + `MINKERT_BACKEND_ORIGIN`).
 * `VITE_API_URL` при сборке; на **хостинге** значения с localhost или `http://` на https-странице игнорируются.
 */
function resolveApiBase(): string {
  const useDirectInDev =
    import.meta.env.VITE_API_DIRECT === 'true' || import.meta.env.VITE_API_DIRECT === '1';
  const raw = import.meta.env.VITE_API_URL;
  let trimmed = typeof raw === 'string' ? raw.trim() : '';

  if (import.meta.env.DEV && !useDirectInDev) {
    return '/api';
  }

  if (typeof window !== 'undefined') {
    const hosted = !isLocalPage();
    if (hosted) {
      const httpOnHttps = window.location.protocol === 'https:' && trimmed.startsWith('http://');
      const pointsToDevMachine =
        trimmed.includes('localhost') || trimmed.includes('127.0.0.1');
      if (pointsToDevMachine || httpOnHttps) {
        trimmed = '';
      }
    }
  }

  const fallback = '/api';
  return (trimmed || fallback).replace(/\/$/, '');
}

const API_BASE = resolveApiBase();

const LOCAL_DEV_HINT =
  ' Самый простой способ: в **корне репозитория** выполните `npm run dev` — запустятся API (порт 3000) и фронт с прокси `/api`. Убедитесь, что PostgreSQL доступен по `DATABASE_URL` в `backend/.env` (часто: из корня `docker compose up -d db`). Вручную: терминал 1 — `cd backend && npm run start:dev`, терминал 2 — `cd frontend && npm run dev`.';

/** Подсказка для деплоя: прямой localhost из браузера на хостинге или забытый бэкенд на Vercel. */
function connectionTroubleshootHint(): string {
  if (typeof window === 'undefined') return '';
  if (isLocalPage()) return '';
  if (API_BASE.includes('127.0.0.1') || API_BASE.includes('localhost')) {
    return ' В Vercel → Settings → Environment Variables: удалите ошибочный VITE_API_URL с localhost. Задайте VITE_API_URL = https://ваш-api.onrender.com/api (обязательно https) или только MINKERT_BACKEND_ORIGIN = https://ваш-api.onrender.com (без /api) и сделайте Redeploy (лучше с галочкой Clear build cache).';
  }
  if (API_BASE === '/api' || API_BASE.endsWith('/api')) {
    return ' В Vercel → Settings → Environment Variables: MINKERT_BACKEND_ORIGIN = https://ваш-сервис.onrender.com (без /api), сохраните → Deployments → Redeploy. В General очистите Root Directory (корень репозитория), чтобы работал корневой middleware.ts; либо оставьте Root = frontend и файл frontend/middleware.ts. Если задан VITE_API_URL с localhost или с http:// — удалите или замените на https://…/api.';
  }
  return '';
}

function connectionErrorSuffix(): string {
  return (isLocalPage() ? LOCAL_DEV_HINT : '') + connectionTroubleshootHint();
}

/** Для отображения в настройках и отладки */
export function getApiBaseUrl(): string {
  return API_BASE;
}

type LoginResponse = {
  tokens: { accessToken: string; refreshToken: string; expiresInSeconds: number };
  user: AuthUser;
};

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshOnce(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      return false;
    }

    if (!res.ok) {
      clearAuthBundle();
      return false;
    }

    const data = (await res.json()) as {
      tokens: { accessToken: string; expiresInSeconds: number; refreshToken: string };
    };

    const user = readStoredUser<AuthUser>();
    if (!user) {
      clearAuthBundle();
      return false;
    }

    setAuthBundle(data.tokens.accessToken, data.tokens.refreshToken, user);
    return true;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function authorizedFetch(input: RequestInfo | URL, init: RequestInit, attempt = 0): Promise<Response> {
  let accessToken = getAccessToken();
  if (!accessToken && attempt === 0 && getRefreshToken()) {
    const refreshed = await tryRefreshOnce();
    if (refreshed) return authorizedFetch(input, init, 1);
  }
  accessToken = getAccessToken();

  const headers = new Headers(init.headers ?? {});
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(input, { ...init, headers });
  } catch {
    throw new Error('Не удаётся связаться с сервером.' + connectionErrorSuffix());
  }
  if (response.status === 401 && attempt === 0) {
    const refreshed = await tryRefreshOnce();
    if (refreshed) return authorizedFetch(input, init, 1);
  }
  return response;
}

export async function apiJson<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth = true, ...rest } = init;
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

  let response: Response;
  try {
    response = auth
      ? await authorizedFetch(url, rest)
      : await fetch(url, {
          ...rest,
          headers: {
            'Content-Type': 'application/json',
            ...(rest.headers ?? {}),
          },
        });
  } catch {
    throw new Error('Не удаётся связаться с сервером.' + connectionErrorSuffix());
  }

  if (!response.ok) {
    let message = `Ошибка ${response.status}`;
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      message = 'Бэкенд не отвечает (502/503 от прокси).' + connectionErrorSuffix();
    } else {
      try {
        const body = (await response.json()) as { message?: string | string[] };
        if (typeof body.message === 'string') message = body.message;
        if (Array.isArray(body.message)) message = body.message.join(', ');
      } catch {
        /* тело не JSON — оставляем код статуса */
      }
    }
    if (response.status === 401 && message === 'Unauthorized') {
      message = 'Сессия истекла или не выполнен вход. Обновите страницу и войдите снова.';
    }
    throw new Error(message);
  }

  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      'Сервер вернул не JSON (часто это HTML вместо API — например SPA без прокси `/api`).' +
        (isLocalPage() ?
          LOCAL_DEV_HINT + ' В dev: бэкенд на порту 3000, запросы на `/api` через Vite.'
        : ' На Vercel: проверьте MINKERT_BACKEND_ORIGIN и Redeploy с Clear build cache; либо VITE_API_URL = https://…/api. Root Directory: пусто (корень репо + middleware.ts) или frontend (frontend/middleware.ts).'),
    );
  }
}

export async function login(email: string, password: string) {
  const data = await apiJson<LoginResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, password }),
  });
  setAuthBundle(data.tokens.accessToken, data.tokens.refreshToken, data.user);
  return data.user;
}

export async function logout() {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      keepalive: true,
    }).catch(() => undefined);
  }
  clearAuthBundle();
}
