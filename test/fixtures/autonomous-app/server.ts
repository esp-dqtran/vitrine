import { createServer, type Server } from "node:http";

export interface FixtureEvent {
  at: number;
  actor: string;
  action: string;
}

export function concurrentMutationCount(events: FixtureEvent[]): number {
  let active = 0;
  let maximum = 0;
  for (const event of events) {
    if (event.action === "mutation-start") maximum = Math.max(maximum, ++active);
    if (event.action === "mutation-end") active--;
  }
  return maximum;
}

function page(title: string, content: string): string {
  return `<!doctype html><html><head><title>${title}</title></head><body><nav><a href="/items">Items</a><a href="/search">Search</a><a href="/settings">Settings</a></nav><main><h1>${title}</h1>${content}</main></body></html>`;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

export async function startAutonomousFixture(): Promise<{
  url: string;
  events: FixtureEvent[];
  close(): Promise<void>;
}> {
  const events: FixtureEvent[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://fixture.test");
    if (url.pathname === "/docs" || url.pathname === "/docs/workflows") {
      response.setHeader("content-type", "text/html");
      response.end(page(url.pathname.endsWith("workflows") ? "Workflow documentation" : "Fixture documentation", `
        <p>Members can search, create, edit, delete, and share items.</p>
        <a href="/docs/workflows">Documented workflows</a>
      `));
      return;
    }
    if (url.pathname.startsWith("/events/")) {
      events.push({ at: Date.now(), actor: url.searchParams.get("actor") ?? "unknown", action: url.pathname.slice("/events/".length) });
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    const authenticated = /(?:^|;\s*)fixture_session=valid(?:;|$)/.test(request.headers.cookie ?? "");
    if (!authenticated && url.pathname !== "/login") {
      response.statusCode = 302;
      response.setHeader("location", "/login");
      response.end();
      return;
    }
    response.setHeader("content-type", "text/html");
    const pages: Record<string, string> = {
      "/login": page("Sign in", '<label>Email <input aria-label="Email"></label><label>Password <input aria-label="Password" type="password"></label><button>Sign in</button>'),
      "/onboarding": page("Welcome", '<button>Complete onboarding</button>'),
      "/items": page("Items", '<a href="/items/new">New item</a><a href="/items/1/edit">Edit item</a><a href="/items/1/delete">Delete item</a><a href="/items/1/share">Share item</a>'),
      "/items/new": page("Create item", '<label>Name <input aria-label="Name"></label><button>Save item</button>'),
      "/items/1/edit": page("Edit item", '<label>Name <input aria-label="Name" value="Roadmap"></label><button>Save changes</button>'),
      "/items/1/delete": page("Delete item", '<p>This action cannot be undone.</p><button>Confirm delete</button>'),
      "/items/1/share": page("Share item", '<label>Member <input aria-label="Member"></label><button>Send invite</button>'),
      "/search": page("Search", '<label>Search items <input aria-label="Search items"></label><p>Roadmap</p>'),
      "/settings": page("Settings", '<button>Save preferences</button><a href="/billing">Billing</a>'),
      "/billing": page("Confirm plan change", '<p>Changes apply immediately.</p><button>Confirm purchase</button>'),
      "/popup": page("Popup navigation", '<button onclick="window.open(\'/items\', \'_blank\')">Open items in new window</button>'),
    };
    response.end(pages[url.pathname] ?? page("Fixture app", '<a href="/onboarding">Start onboarding</a>'));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture server did not bind a TCP port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    events,
    close: () => closeServer(server),
  };
}
