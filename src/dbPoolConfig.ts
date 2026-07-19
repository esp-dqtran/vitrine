export function databasePoolOptions(
  env: Record<string, string | undefined>,
): { max?: number } {
  const raw = env.DATABASE_POOL_MAX;
  if (raw === undefined || raw === "") return {};
  const max = Number(raw);
  if (!Number.isInteger(max) || max < 1) {
    throw new Error("DATABASE_POOL_MAX must be a positive integer");
  }
  return { max };
}
