const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const BASE_URL = VITE_API_URL.endsWith('/api') ? VITE_API_URL : `${VITE_API_URL.replace(/\/$/, '')}/api`;

interface ApiOptions {
  method?: string;
  body?: object;
  token?: string;
}

const checkSessionExpiry = (res: Response, wasAuthenticated: boolean, errorBody?: any) => {
  // Only fire session events if the request was made with a token.
  const isAdminRoute = window.location.pathname.startsWith('/hq-portal');

  if (res.status === 401 && wasAuthenticated) {
    if (isAdminRoute) {
      localStorage.removeItem('admin_token');
      window.location.href = '/hq-portal/login';
    } else {
      window.dispatchEvent(new CustomEvent('session_expired'));
    }
    return;
  }

  // Handle suspended / deactivated accounts for authenticated users
  if (res.status === 403 && wasAuthenticated && !isAdminRoute) {
    const errorMsg: string = errorBody?.error || '';
    if (errorMsg.toLowerCase().includes('suspended')) {
      window.dispatchEvent(new CustomEvent('account_suspended'));
    } else if (errorMsg.toLowerCase().includes('deactivated')) {
      window.dispatchEvent(new CustomEvent('account_deactivated'));
    }
  }
};

export async function apiFetch(path: string, { method = 'GET', body, token }: ApiOptions = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    const text = await res.text().catch(() => '');
    data = { error: 'server_error', message: text || 'An unexpected server error occurred.' };
  }

  if (!res.ok) {
    checkSessionExpiry(res, !!token, data);
    const err = new Error(data?.message || data?.error || 'Something went wrong.') as any;
    err.status = res.status;
    err.body = data; // preserve full structured body for callers
    throw err;
  }
  return data;
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
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: formData,
  });

  let data: any;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    const text = await res.text().catch(() => '');
    data = { error: 'server_error', message: text || 'An unexpected server error occurred.' };
  }

  if (!res.ok) {
    checkSessionExpiry(res, !!token, data);
    throw new Error(data?.error || data?.message || 'Something went wrong.');
  }
  return data;
}

