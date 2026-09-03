const INTERNAL_MOBBIN_FLOW_PREFIX = "mobbin-flow-";
const PUBLIC_IMPORTED_FLOW_PREFIX = "flow-";

/**
 * Keep source-specific identifiers inside Vitrines while presenting a neutral,
 * stable Flow identifier to users and external clients.
 */
export function publicFlowId(flowId: string): string {
  return flowId.startsWith(INTERNAL_MOBBIN_FLOW_PREFIX)
    ? `${PUBLIC_IMPORTED_FLOW_PREFIX}${flowId.slice(INTERNAL_MOBBIN_FLOW_PREFIX.length)}`
    : flowId;
}

/** Accept both current public IDs and legacy source-prefixed links. */
export function flowIdsMatch(left: string, right: string): boolean {
  return publicFlowId(left) === publicFlowId(right);
}

/** Sanitize the Flow portion of catalog/search references such as flow:app:id. */
export function publicFlowReferenceId(referenceId: string): string {
  const match = /^flow:([^:]+):(.+)$/.exec(referenceId);
  return match ? `flow:${match[1]}:${publicFlowId(match[2])}` : referenceId;
}
