import { apiFetch, clearAuthToken, getAuthToken, setAuthToken } from "./apiFetch.ts";

export interface AuthUser {
  id: number;
  email: string;
  role: "admin" | "user";
}

interface AuthResponse {
  user: AuthUser;
  token: string;
  expiresAt: string;
}

async function authResponseOrError(response: Response): Promise<AuthUser> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? `Authentication returned ${response.status}`);
  }
  const auth = body as AuthResponse;
  setAuthToken(auth.token);
  return auth.user;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await apiFetch("/api/auth/me");
  const body = await response.json();
  if (!response.ok || body === null) {
    clearAuthToken();
    if (!response.ok && response.status !== 401) {
      throw new Error(body?.error ?? `Authentication returned ${response.status}`);
    }
    return null;
  }
  return body as AuthUser;
}

export function login(email: string, password: string): Promise<AuthUser> {
  return fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then(authResponseOrError);
}

export function signup(email: string, password: string, referralToken?: string): Promise<AuthUser> {
  return fetch("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, ...(referralToken ? { referralToken } : {}) }),
  }).then(authResponseOrError);
}

export async function logout(): Promise<void> {
  try {
    if (getAuthToken()) {
      const response = await apiFetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error(`Logout returned ${response.status}`);
    }
  } finally {
    clearAuthToken();
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await apiFetch("/api/auth/password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Password change returned ${response.status}`);
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetch("/api/auth/password-reset/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw new Error("Unable to request a password reset");
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const response = await fetch("/api/auth/password-reset", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Unable to reset password");
  }
}
