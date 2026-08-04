const BEARER_PREFIX = "Bearer ";
export const WEBSOCKET_BEARER_PROTOCOL = "vitrines-bearer";
const MAX_TOKEN_LENGTH = 8_192;

export function bearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith(BEARER_PREFIX)) return undefined;
  const token = header.slice(BEARER_PREFIX.length);
  if (!token || token.length > MAX_TOKEN_LENGTH || /\s/.test(token)) return undefined;
  return token;
}

export function webSocketBearerToken(header: string | undefined): string | undefined {
  const protocols = header?.split(",").map((value) => value.trim()) ?? [];
  const marker = protocols.indexOf(WEBSOCKET_BEARER_PROTOCOL);
  if (marker < 0) return undefined;
  const token = protocols[marker + 1];
  if (!token || token.length > MAX_TOKEN_LENGTH || /\s/.test(token)) return undefined;
  return token;
}
