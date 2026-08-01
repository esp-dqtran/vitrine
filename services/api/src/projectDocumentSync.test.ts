import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";

import type { IncomingMessage } from "node:http";

import type { ProjectDocument } from "../../../src/projectDocument.ts";
import type { ProjectDocumentStore } from "../../../src/projectDocumentStore.ts";
import type { OctoBaseClient } from "./octobaseClient.ts";
import type { OctobaseYjsBridge } from "./octobaseYjsBridge.ts";
import { createProjectDocumentSyncGateway } from "./projectDocumentSync.ts";

const document: ProjectDocument = {
  id: 41,
  projectId: 7,
  ownerUserId: 3,
  documentKey: "main",
  title: "Project notes",
  icon: "none",
  isFavorite: false,
  pageWidth: "standard",
  octobaseDocumentId: "workspace-1",
  lastEditorMode: "page",
  integrationVersion: "integration-1",
  journalDate: null,
  trashedAt: null,
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
};

function request(url: string, cookie?: string): IncomingMessage {
  return {
    url,
    headers: cookie ? { cookie } : {},
  } as IncomingMessage;
}

function setup(
  input: {
    enabled?: boolean;
    findOwned?: () => Promise<ProjectDocument | undefined>;
    resolve?: () => Promise<
      | {
          status: "authenticated";
          user: { id: number; email: string; role: "user" };
        }
      | { status: "invalid" }
      | { status: "signed_in_elsewhere" }
    >;
    revalidateMs?: number;
    publicShare?: () => Promise<
      | { document: ProjectDocument; sharedAt: string }
      | undefined
    >;
  } = {},
) {
  const accepted: Array<{
    requestUrl?: string;
    workspaceId: string;
    token: string;
    readOnly?: boolean;
  }> = [];
  let closed = false;
  const bridge: OctobaseYjsBridge = {
    accept(upgradeRequest, _socket, _head, target) {
      accepted.push({ requestUrl: upgradeRequest.url, ...target });
    },
    close() {
      closed = true;
    },
  };
  const store = {
    findOwned: input.findOwned ?? (async () => document),
    publicShare:
      input.publicShare ??
      (async () => ({
        document,
        sharedAt: "2026-07-31T10:00:00.000Z",
      })),
  } as unknown as ProjectDocumentStore;
  const octobaseClient = {
    accessToken: async () => "private-octobase-token",
  } as OctoBaseClient;
  const gateway = createProjectDocumentSyncGateway({
    enabled: input.enabled ?? true,
    testProjectId: 7,
    store,
    octobaseClient,
    bridge,
    resolveSessionState:
      input.resolve ??
      (async () => ({
        status: "authenticated",
        user: { id: 3, email: "owner@example.test", role: "user" },
      })),
    revalidateMs: input.revalidateMs ?? 30_000,
  });
  return { gateway, accepted, wasClosed: () => closed };
}

test("ignores non-project-document upgrade paths", async () => {
  const { gateway, accepted } = setup();
  const socket = new PassThrough();

  await gateway.handleUpgrade(request("/other"), socket, Buffer.alloc(0));

  assert.equal(socket.destroyed, false);
  assert.equal(accepted.length, 0);
  gateway.close();
});

test("rejects malformed, disabled, and unauthenticated upgrades", async () => {
  for (const [gateway, upgradeRequest] of [
    [
      setup().gateway,
      request("/project-document-sync/nope/41", "astryx_session=x"),
    ],
    [
      setup({ enabled: false }).gateway,
      request("/project-document-sync/7/41", "astryx_session=x"),
    ],
    [setup().gateway, request("/project-document-sync/7/41")],
    [
      setup({ resolve: async () => ({ status: "invalid" }) }).gateway,
      request("/project-document-sync/7/41", "astryx_session=x"),
    ],
  ] as const) {
    const socket = new PassThrough();
    await gateway.handleUpgrade(upgradeRequest, socket, Buffer.alloc(0));
    assert.equal(socket.destroyed, true);
    gateway.close();
  }
});

test("authorizes exact owner and passes private target only to the bridge", async () => {
  const { gateway, accepted } = setup();
  const upgradeRequest = request(
    "/project-document-sync/7/41",
    "astryx_session=session-1",
  );

  await gateway.handleUpgrade(
    upgradeRequest,
    new PassThrough(),
    Buffer.alloc(0),
  );

  assert.equal(accepted.length, 1);
  assert.deepEqual(
    {
      requestUrl: accepted[0]?.requestUrl,
      workspaceId: accepted[0]?.workspaceId,
      token: accepted[0]?.token,
    },
    {
      requestUrl: "/project-document-sync/7/41",
      workspaceId: "workspace-1",
      token: "private-octobase-token",
    },
  );
  assert.equal(typeof accepted[0]?.onWrite, "function");
  assert.doesNotMatch(
    upgradeRequest.url ?? "",
    /private-octobase-token|workspace-1/,
  );
  gateway.close();
});

test("authorizes active public shares as read-only sync targets", async () => {
  const { gateway, accepted } = setup();
  const shareToken = "a".repeat(43);

  await gateway.handleUpgrade(
    request(`/project-document-share-sync/${shareToken}/41`),
    new PassThrough(),
    Buffer.alloc(0),
  );

  assert.deepEqual(accepted, [
    {
      requestUrl:
        `/project-document-share-sync/${shareToken}/41`,
      workspaceId: "workspace-1",
      token: "private-octobase-token",
      readOnly: true,
    },
  ]);
  gateway.close();
});

test("rejects invalid, revoked, and mismatched public shares", async () => {
  const cases: Array<{
    url: string;
    publicShare: () => Promise<
      | { document: ProjectDocument; sharedAt: string }
      | undefined
    >;
  }> = [
    {
      url: "/project-document-share-sync/invalid/41",
      publicShare: async () => ({
        document,
        sharedAt: "2026-07-31T10:00:00.000Z",
      }),
    },
    {
      url: `/project-document-share-sync/${"a".repeat(43)}/41`,
      publicShare: async () => undefined,
    },
    {
      url: `/project-document-share-sync/${"a".repeat(43)}/99`,
      publicShare: async () => ({
        document,
        sharedAt: "2026-07-31T10:00:00.000Z",
      }),
    },
  ];
  for (const candidate of cases) {
    const { gateway, accepted } = setup({
      publicShare: candidate.publicShare,
    });
    const socket = new PassThrough();
    await gateway.handleUpgrade(
      request(candidate.url),
      socket,
      Buffer.alloc(0),
    );
    assert.equal(socket.destroyed, true);
    assert.equal(accepted.length, 0);
    gateway.close();
  }
});

test("rejects cross-user, cross-Project, and missing documents", async () => {
  const { gateway, accepted } = setup({
    findOwned: async () => undefined,
  });
  const socket = new PassThrough();

  await gateway.handleUpgrade(
    request("/project-document-sync/7/41", "astryx_session=x"),
    socket,
    Buffer.alloc(0),
  );

  assert.equal(socket.destroyed, true);
  assert.equal(accepted.length, 0);
  gateway.close();
});

test("revalidates the original session and closes revoked sockets", async () => {
  let resolutions = 0;
  const { gateway } = setup({
    revalidateMs: 10,
    resolve: async () => {
      resolutions += 1;
      return resolutions === 1
        ? {
            status: "authenticated",
            user: { id: 3, email: "owner@example.test", role: "user" },
          }
        : { status: "signed_in_elsewhere" };
    },
  });
  const socket = new PassThrough();

  await gateway.handleUpgrade(
    request("/project-document-sync/7/41", "astryx_session=session-1"),
    socket,
    Buffer.alloc(0),
  );
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(socket.destroyed, true);
  gateway.close();
});

test("gateway shutdown disposes its bridge", () => {
  const { gateway, wasClosed } = setup();
  gateway.close();
  assert.equal(wasClosed(), true);
});
