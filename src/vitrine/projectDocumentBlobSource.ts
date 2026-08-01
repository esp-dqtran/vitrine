import type { BlobSource } from "@blocksuite/sync";

type FetchPort = typeof fetch;

export class ProjectDocumentHttpBlobSource implements BlobSource {
  readonly name: string;
  readonly readonly: boolean;

  constructor(
    private readonly baseUrl: string,
    options: {
      readOnly?: boolean;
      fetch?: FetchPort;
    } = {},
  ) {
    this.name = `astryx-http:${baseUrl}`;
    this.readonly = options.readOnly ?? false;
    this.fetch = options.fetch ?? fetch;
  }

  private readonly fetch: FetchPort;

  async get(key: string): Promise<Blob | null> {
    const response = await this.fetch(
      `${this.baseUrl}/${encodeURIComponent(key)}`,
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Project document blob download failed (${response.status})`);
    }
    return response.blob();
  }

  async set(key: string, value: Blob): Promise<string> {
    if (this.readonly) throw new Error("Project document blobs are read-only");
    const response = await this.fetch(
      `${this.baseUrl}/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/octet-stream",
          "x-astryx-blob-content-type":
            value.type || "application/octet-stream",
        },
        body: value,
      },
    );
    if (!response.ok) {
      throw new Error(`Project document blob upload failed (${response.status})`);
    }
    return key;
  }

  async delete(key: string): Promise<void> {
    if (this.readonly) throw new Error("Project document blobs are read-only");
    const response = await this.fetch(
      `${this.baseUrl}/${encodeURIComponent(key)}`,
      { method: "DELETE" },
    );
    if (!response.ok && response.status !== 404) {
      throw new Error(`Project document blob delete failed (${response.status})`);
    }
  }

  async list(): Promise<string[]> {
    const response = await this.fetch(this.baseUrl);
    if (!response.ok) {
      throw new Error(`Project document blob listing failed (${response.status})`);
    }
    const value = await response.json() as { ids?: unknown };
    return Array.isArray(value.ids)
      ? value.ids.filter((id): id is string => typeof id === "string")
      : [];
  }
}
