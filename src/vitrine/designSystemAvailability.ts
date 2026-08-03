export function hasDesignSystemContent(snapshot: {
  tokens: unknown[];
  components: unknown[];
  rules?: unknown[];
} | null | undefined): boolean {
  return Boolean(snapshot && (
    snapshot.tokens.length
    || snapshot.components.length
    || snapshot.rules?.length
  ));
}
