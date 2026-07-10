type Allowed = { allowed: true } | { allowed: false; retryAfterSeconds: number };

const retryAfter = (startedAt: number, windowMs: number, now: number): number =>
  Math.max(1, Math.ceil((startedAt + windowMs - now) / 1000));

export function createFixedWindowLimiter(input: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): { check(key: string): Allowed } {
  const now = input.now ?? Date.now;
  const entries = new Map<string, { startedAt: number; count: number }>();
  return {
    check(key) {
      const time = now();
      let entry = entries.get(key);
      if (!entry || time - entry.startedAt >= input.windowMs) {
        entry = { startedAt: time, count: 0 };
        entries.set(key, entry);
      }
      if (entry.count >= input.limit) {
        return { allowed: false, retryAfterSeconds: retryAfter(entry.startedAt, input.windowMs, time) };
      }
      entry.count++;
      return { allowed: true };
    },
  };
}

export function createDistinctValueLimiter(input: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): { check(key: string, value: string): Allowed } {
  const now = input.now ?? Date.now;
  const entries = new Map<string, { startedAt: number; values: Set<string> }>();
  return {
    check(key, value) {
      const time = now();
      let entry = entries.get(key);
      if (!entry || time - entry.startedAt >= input.windowMs) {
        entry = { startedAt: time, values: new Set() };
        entries.set(key, entry);
      }
      if (!entry.values.has(value) && entry.values.size >= input.limit) {
        return { allowed: false, retryAfterSeconds: retryAfter(entry.startedAt, input.windowMs, time) };
      }
      entry.values.add(value);
      return { allowed: true };
    },
  };
}

export function ipPrefix(address: string): string {
  if (address.startsWith("::ffff:")) return ipPrefix(address.slice(7));
  const ipv4 = address.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (ipv4) return `${ipv4[1]}.${ipv4[2]}.${ipv4[3]}.0/24`;
  if (address.includes(":")) return `${address.split(":").slice(0, 4).join(":")}::/64`;
  return "unknown";
}
