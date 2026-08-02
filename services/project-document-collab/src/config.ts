function collaborationOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Project document collaboration origins must use HTTP or HTTPS");
  }
  return url.origin;
}

export function projectDocumentAllowedOrigins(
  environment: NodeJS.ProcessEnv,
): ReadonlySet<string> {
  const configured = environment.PROJECT_DOCUMENT_COLLAB_ALLOWED_ORIGINS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured?.length) return new Set(configured.map(collaborationOrigin));
  if (environment.NODE_ENV !== "production") return new Set();
  if (!environment.APP_URL?.trim()) {
    throw new Error(
      "APP_URL or PROJECT_DOCUMENT_COLLAB_ALLOWED_ORIGINS is required in production",
    );
  }
  return new Set([collaborationOrigin(environment.APP_URL)]);
}
