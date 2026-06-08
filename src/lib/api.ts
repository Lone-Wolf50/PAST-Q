const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const BASE_URL = VITE_API_URL.endsWith('/api') ? VITE_API_URL : `${VITE_API_URL.replace(/\/$/, '')}/api`;

interface ApiOptions {
  method?: string;
  body?: object;
  token?: string;
}

const PWA_REFRESH_KEY = 'pastq_pwa_rt';


let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  try {
    // Attempt 1: Cookie-based refresh
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.token) {
        window.dispatchEvent(new CustomEvent('token_refreshed', { detail: { token: data.token, user: data.user, refreshToken: data.refreshToken } }));
        return data.token;
      }
    }

    // Attempt 2: PWA localStorage fallback
    const storedRefresh = localStorage.getItem(PWA_REFRESH_KEY);
    if (storedRefresh) {
      const fallbackRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefresh }),
      });
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        if (data && data.token) {
          window.dispatchEvent(new CustomEvent('token_refreshed', { detail: { token: data.token, user: data.user, refreshToken: data.refreshToken } }));
          return data.token;
        }
      }
      // Token was invalid — clean up
      localStorage.removeItem(PWA_REFRESH_KEY);
    }

    return null;
  } catch (e) {
    return null;
  }
}

async function runFetch(
  path: string,
  headers: Record<string, string>,
  method: string,
  body: object | undefined,
  formData: FormData | undefined
): Promise<{ res: Response; data: any }> {
  const fetchOptions: RequestInit = {
    method,
    headers,
    body: formData ? formData : (body ? JSON.stringify(body) : undefined),
    credentials: 'include', // Ensures HTTP-only cookies are sent and received
  };

  const res = await fetch(`${BASE_URL}${path}`, fetchOptions);

  let data: any;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    const text = await res.text().catch(() => '');
    data = { error: 'server_error', message: text || 'An unexpected server error occurred.' };
  }

  return { res, data };
}

async function executeRequest(
  path: string,
  method: string,
  body: object | undefined,
  formData: FormData | undefined,
  token: string | undefined
): Promise<any> {
  const headers: Record<string, string> = {};
  if (!formData && body) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let { res, data } = await runFetch(path, headers, method, body, formData);

  const isAdminRoute = window.location.pathname.startsWith('/hq-portal');
  const isAuthRoute =
    path.startsWith('/auth/refresh') ||
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/register') ||
    path.startsWith('/auth/verify-otp');

  if (res.status === 401) {
    if (isAdminRoute) {
      localStorage.removeItem('admin_token');
      window.location.href = '/hq-portal/login';
      const err = new Error(data?.message || data?.error || 'Unauthorized') as any;
      err.status = 401;
      err.body = data;
      throw err;
    }

    if (!isAuthRoute) {
      // Attempt silent refresh
      if (!refreshPromise) {
        refreshPromise = performRefresh().then((newToken) => {
          refreshPromise = null;
          return newToken;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        // Retry the original request with the new access token
        const retryHeaders: Record<string, string> = { ...headers };
        retryHeaders['Authorization'] = `Bearer ${newToken}`;
        const retry = await runFetch(path, retryHeaders, method, body, formData);
        res = retry.res;
        data = retry.data;
      } else {
        // Refresh failed, trigger logout
        window.dispatchEvent(new CustomEvent('session_expired'));
        const err = new Error(data?.message || data?.error || 'Session expired') as any;
        err.status = 401;
        err.body = data;
        throw err;
      }
    }
  }

  // Handle suspended / deactivated accounts for authenticated users
  if (res.status === 403 && !isAdminRoute) {
    const errorMsg: string = data?.error || '';
    if (errorMsg.toLowerCase().includes('suspended')) {
      window.dispatchEvent(new CustomEvent('account_suspended'));
    } else if (errorMsg.toLowerCase().includes('deactivated')) {
      window.dispatchEvent(new CustomEvent('account_deactivated'));
    }
  }

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'Something went wrong.') as any;
    err.status = res.status;
    err.body = data; // preserve full structured body for callers
    throw err;
  }

  return data;
}

export async function apiFetch(path: string, { method = 'GET', body, token }: ApiOptions = {}) {
  return executeRequest(path, method, body, undefined, token);
}

/**
 * Send multipart/form-data (e.g. file uploads).
 * Do NOT set Content-Type manually — the browser does it with the correct boundary.
 */
export async function apiFetchMultipart(
  path: string,
  formData: FormData,
  { method = 'POST', token }: { method?: string; token?: string } = {}
) {
  return executeRequest(path, method, undefined, formData, token);
}

export async function apiDownload(path: string, token: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errData: any = null;
    try {
      errData = await response.json();
    } catch {}
    const err = new Error(errData?.message || errData?.error || 'Download failed.') as any;
    err.status = response.status;
    err.body = errData;
    throw err;
  }

  return response.blob();
}
