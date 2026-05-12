const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const BASE_URL = VITE_API_URL.endsWith('/api') ? VITE_API_URL : `${VITE_API_URL.replace(/\/$/, '')}/api`;

interface ApiOptions {
  method?: string;
  body?: object;
  token?: string;
}

const checkSessionExpiry = (res: Response, data: any) => {
  if (res.status === 401 && data?.code === 'SESSION_EXPIRED') {
    window.dispatchEvent(new CustomEvent('session_expired'));
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

  const data = await res.json();
  if (!res.ok) {
    checkSessionExpiry(res, data);
    const err = new Error(data.message || data.error || 'Something went wrong.') as any;
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

  const data = await res.json();
  if (!res.ok) {
    checkSessionExpiry(res, data);
    throw new Error(data.error || 'Something went wrong.');
  }
  return data;
}
