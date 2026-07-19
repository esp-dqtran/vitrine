import type { AdminUser } from './types.ts';

export function mergeUserPages(current: AdminUser[], incoming: AdminUser[]): AdminUser[] {
  const users = new Map(current.map((user) => [user.id, user]));
  for (const user of incoming) users.set(user.id, user);
  return [...users.values()];
}
