export const SESSION_COOKIE = "astryx_session";

export function cookieValue(
  header: string | undefined,
  name: string,
): string | undefined {
  for (const pair of header?.split(";") ?? []) {
    const [key, ...value] = pair.trim().split("=");
    if (key !== name) continue;
    try {
      return decodeURIComponent(value.join("="));
    } catch {
      return undefined;
    }
  }
  return undefined;
}
