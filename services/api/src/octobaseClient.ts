export interface OctoBaseClient {
  accessToken(): Promise<string>;
  createWorkspace(): Promise<string>;
  deleteWorkspace(workspaceId: string): Promise<void>;
}

export interface OctoBaseConfig {
  url: string;
  serviceEmail: string;
  servicePassword: string;
}

type OctoBaseClientOptions = {
  fetch?: typeof fetch;
  nowSeconds?: () => number;
};

function required(
  env: Record<string, string | undefined>,
  name: string,
): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function octobaseConfigFromEnv(
  env: Record<string, string | undefined>,
): OctoBaseConfig | undefined {
  if (env.PROJECT_DOCUMENTS_ENABLED !== "true") return undefined;
  const url = required(env, "OCTOBASE_URL");
  if (!/^https?:\/\//.test(url)) {
    throw new Error("OCTOBASE_URL must be an absolute HTTP URL");
  }
  return {
    url: url.replace(/\/+$/, ""),
    serviceEmail: required(env, "OCTOBASE_SERVICE_EMAIL"),
    servicePassword: required(env, "OCTOBASE_SERVICE_PASSWORD"),
  };
}

function jwtExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    if (!payload) return 0;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown;
    };
    return Number.isFinite(Number(parsed.exp)) ? Number(parsed.exp) : 0;
  } catch {
    return 0;
  }
}

export function createOctoBaseClient(
  config: OctoBaseConfig,
  options: OctoBaseClientOptions = {},
): OctoBaseClient {
  const request = options.fetch ?? fetch;
  const nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1_000));
  let createAttempted = false;
  let cachedToken = "";
  let cachedExpiry = 0;

  async function authenticate(payload: Record<string, unknown>): Promise<string> {
    const response = await request(`${config.url}/api/user/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`OctoBase authentication failed with HTTP ${response.status}`);
    }
    let body: { token?: unknown };
    try {
      body = await response.json() as { token?: unknown };
    } catch {
      throw new Error("OctoBase authentication returned an invalid response");
    }
    if (typeof body.token !== "string" || !body.token) {
      throw new Error("OctoBase authentication returned an invalid response");
    }
    return body.token;
  }

  async function login(): Promise<string> {
    return authenticate({
      type: "DebugLoginUser",
      email: config.serviceEmail,
      password: config.servicePassword,
    });
  }

  return {
    async accessToken() {
      if (cachedToken && cachedExpiry > nowSeconds() + 60) {
        return cachedToken;
      }

      let token: string;
      if (!createAttempted) {
        createAttempted = true;
        try {
          token = await authenticate({
            type: "DebugCreateUser",
            name: "Astryx Integration",
            avatar_url: null,
            email: config.serviceEmail,
            password: config.servicePassword,
          });
        } catch {
          token = await login();
        }
      } else {
        token = await login();
      }

      cachedToken = token;
      cachedExpiry = jwtExpiry(token);
      return token;
    },

    async createWorkspace() {
      const token = await this.accessToken();
      const response = await request(`${config.url}/api/workspace`, {
        method: "POST",
        headers: {
          authorization: token,
          "content-type": "application/octet-stream",
          "content-length": "0",
        },
        body: new Uint8Array(),
      });
      if (!response.ok) {
        throw new Error(`OctoBase workspace creation failed with HTTP ${response.status}`);
      }
      let body: { id?: unknown };
      try {
        body = await response.json() as { id?: unknown };
      } catch {
        throw new Error("OctoBase workspace creation returned an invalid response");
      }
      if (typeof body.id !== "string" || !body.id) {
        throw new Error("OctoBase workspace creation returned an invalid response");
      }
      return body.id;
    },

    async deleteWorkspace(workspaceId) {
      const token = await this.accessToken();
      const response = await request(
        `${config.url}/api/workspace/${encodeURIComponent(workspaceId)}`,
        {
          method: "DELETE",
          headers: { authorization: token },
        },
      );
      if (!response.ok && response.status !== 404) {
        throw new Error(
          `OctoBase workspace deletion failed with HTTP ${response.status}`,
        );
      }
    },
  };
}
