import type { AdminUser, UserFilter } from "./types.ts";

export const USER_FILTER_LABELS: Record<UserFilter, string> = {
  all: "All members",
  admin: "Administrators",
  pro: "Pro members",
  free: "Free members",
  disabled: "Disabled",
};

export function userPlanLabel(user: AdminUser) {
  return user.subscription_status === "active" ? "Pro" : "Free";
}

export function filterAdminUsers(users: AdminUser[], query: string, filter: UserFilter) {
  const needle = query.trim().toLocaleLowerCase();

  return users.filter((user) => {
    const matchesQuery = !needle || user.email.toLocaleLowerCase().includes(needle);
    const matchesFilter = filter === "all"
      || (filter === "admin" && user.role === "admin")
      || (filter === "pro" && userPlanLabel(user) === "Pro")
      || (filter === "free" && userPlanLabel(user) === "Free")
      || (filter === "disabled" && !user.active);

    return matchesQuery && matchesFilter;
  });
}

export function userInitial(email: string) {
  const localPart = email.trim().split("@")[0] ?? "";
  return localPart.slice(0, 1).toUpperCase() || "?";
}

export function formatJoinedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown join date";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatConversion(activeSubscribers: number, totalUsers: number) {
  return totalUsers > 0
    ? `${((activeSubscribers / totalUsers) * 100).toFixed(1)}%`
    : "—";
}
