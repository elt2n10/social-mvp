const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

export function getDevToken() {
  return sessionStorage.getItem('devToken');
}

export function setDevToken(token) {
  sessionStorage.setItem('devToken', token);
}

export function clearDevToken() {
  sessionStorage.removeItem('devToken');
  localStorage.removeItem('devAccess'); // убираем старый флаг из прошлых версий
}

export async function api(path, options = {}) {
  const token = getToken();
  const devToken = getDevToken();

  const headers = {
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) headers.Authorization = `Bearer ${token}`;
  if (devToken) headers['x-dev-token'] = devToken;

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) clearToken();
    const error = new Error(data.message || 'Ошибка запроса');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function fileUrl(path) {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  if (path.startsWith('/yved') || path.startsWith('/favicon')) return path;
  return `${API_URL}${path}`;
}
