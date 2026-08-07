const AUTH_TOKEN_KEY = "vitrine:auth-token";

let memoryToken: string | null = null;

function browserLocalStorage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function getAuthToken(): string | null {
  if (memoryToken) return memoryToken;
  memoryToken = browserLocalStorage()?.getItem(AUTH_TOKEN_KEY) ?? null;
  return memoryToken;
}

export function setAuthToken(token: string): void {
  memoryToken = token;
  browserLocalStorage()?.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  memoryToken = null;
  browserLocalStorage()?.removeItem(AUTH_TOKEN_KEY);
}

function isSameOriginApiRequest(input: string | URL | Request): boolean {
  const value = input instanceof Request ? input.url : String(input);
  if (value.startsWith("/api/")) return true;
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

export function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  if (!token || !isSameOriginApiRequest(input)) return fetch(input, init);

  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  headers.set("authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
