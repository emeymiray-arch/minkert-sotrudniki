import {
  clearAuthBundle,
  getAccessToken,
  getRefreshToken,
  readStoredUser,
  setAuthBundle,
} from '@/lib/storage';
import type { AuthUser } from '@/lib/types';

/** База API: в `npm run dev` всегда `/api` (прокси Vite → :3000). Для прямого URL в dev задайте VITE_API_DIRECT=true. В проде — VITE_API_URL при сборке. */
function resolveApiBase(): string {
  const useDirectInDev =
    import.meta.env.VITE_API_DIRECT === 'true' || import.meta.env.VITE_API_DIRECT === '1';
  const raw = import.meta.env.VITE_API_URL;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';

  if (import.meta.env.DEV && !useDirectInDev) {
    return '/api';
  }

  const fallback = import.meta.env.DEV ? '/api' : 'http://localhost:3000/api';
  return (trimmed || fallback).replace(/\/$/, '');
}

const API_BASE = resolveApiBase();

/** Подсказка, если фронт на Vercel, а API_BASE всё ещё localhost (забыли VITE_API_URL при сборке). */
function connectionTroubleshootHint(): string {
  if (typeof window === 'undefined') return '';
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return '';
  if (API_BASE.includes('127.0.0.1') || API_BASE.includes('localhost')) {
    return ' На Vercel: Settings → Environment Variables → VITE_API_URL = https://ваш-backend.../api → Redeploy (без пересборки переменная не попадёт в клиент).';
  }
  return '';
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
    throw new Error(
      'Не удаётся связаться с сервером. Запустите бэкенд: в папке backend выполните `npm run start:dev` (и поднимите PostgreSQL, например `docker compose up -d db`).' +
        connectionTroubleshootHint(),
    );
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
    throw new Error(
      'Не удаётся связаться с сервером. Запустите бэкенд: в папке backend выполните `npm run start:dev` (и поднимите PostgreSQL, например `docker compose up -d db`).' +
        connectionTroubleshootHint(),
    );
  }

  if (!response.ok) {
    let message = `Ошибка ${response.status}`;
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      message =
        'Бэкенд не отвечает (502/503 от прокси). Запустите API в отдельном терминале: cd backend && npm run start:dev. Убедитесь, что порт 3000 свободен и PostgreSQL запущен (brew services start postgresql@16). Либо из корня проекта: npm run dev' +
        connectionTroubleshootHint();
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
      'Сервер вернул не JSON (часто это HTML-страница ошибки). Проверьте, что бэкенд запущен на порту 3000 и что в dev используется прокси `/api` или верный VITE_API_URL.',
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
