interface CanvasAssetUploadResponse {
  src: string;
}

export async function uploadProjectCanvasAsset(
  projectId: string,
  assetId: string,
  file: Blob,
  signal?: AbortSignal,
): Promise<string> {
  const assetPath = `/api/designer-canvases/${projectId}/assets`;
  const response = await fetch(`${assetPath}/${encodeURIComponent(assetId)}`, {
    method: "POST",
    headers: { "content-type": file.type },
    body: file,
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Canvas asset upload returned ${response.status}`);
  }
  const body = await response.json() as CanvasAssetUploadResponse;
  return body.src;
}
