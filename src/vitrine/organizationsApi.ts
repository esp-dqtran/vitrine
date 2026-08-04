import { apiFetch } from './apiFetch.ts';

export type TeamRole = 'owner' | 'admin' | 'member';

export interface TeamSummary {
  id: number;
  name: string;
  role: TeamRole;
  memberCount: number;
  createdAt: string;
}

export interface TeamMember {
  userId: number;
  email: string;
  role: TeamRole;
  createdAt: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `${url} returned ${response.status}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

const jsonHeaders = { 'content-type': 'application/json' };

export const listTeams = (): Promise<TeamSummary[]> => request('/api/organizations');

export const createTeam = (name: string): Promise<TeamSummary> => request('/api/organizations', {
  method: 'POST',
  headers: jsonHeaders,
  body: JSON.stringify({ name }),
});

export const listTeamMembers = (teamId: number): Promise<TeamMember[]> =>
  request(`/api/organizations/${teamId}/members`);

export const addTeamMember = (
  teamId: number,
  email: string,
  role: 'admin' | 'member',
): Promise<TeamMember> => request(`/api/organizations/${teamId}/members`, {
  method: 'POST',
  headers: jsonHeaders,
  body: JSON.stringify({ email, role }),
});

export const removeTeamMember = (teamId: number, userId: number): Promise<void> =>
  request(`/api/organizations/${teamId}/members/${userId}`, { method: 'DELETE' });
