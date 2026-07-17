export interface AuthUser {
  id: number;
  email: string;
  role: "admin" | "user";
}

async function jsonOrError(response: Response): Promise<AuthUser> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? `Authentication returned ${response.status}`);
  }
  return body;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/me");
  if (response.status === 401) return null;
  return jsonOrError(response);
}

export function login(email: string, password: string): Promise<AuthUser> {
  return fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then(jsonOrError);
}

export function signup(email: string, password: string): Promise<AuthUser> {
  return fetch("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then(jsonOrError);
}

export async function logout(): Promise<void> {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  if (!response.ok) throw new Error(`Logout returned ${response.status}`);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await fetch("/api/auth/password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Password change returned ${response.status}`);
  }
}
