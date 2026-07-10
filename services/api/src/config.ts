export function adminSeedFromEnv(env: Record<string, string | undefined>) {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }
  if (!password) throw new Error("ADMIN_PASSWORD is required");
  if (password.length < 16) {
    throw new Error("ADMIN_PASSWORD must contain at least 16 characters");
  }
  return { email, password };
}
