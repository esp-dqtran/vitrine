import assert from "node:assert/strict";
import test from "node:test";
import {
  createWappalyzerTechnologyDetector,
  type WappalyzerBrowserPorts,
} from "./wappalyzerBrowser.ts";

test("runs Wappalyzer in an isolated profile and disables telemetry before navigation", async () => {
  const events: string[] = [];
  const ports = fixturePorts(events, [{
    name: "React",
    slug: "react",
    categories: [{ name: "JavaScript libraries" }],
    confidence: 100,
    icon: "React.svg",
  }]);
  const detector = await createWappalyzerTechnologyDetector({
    extensionPath: "/approved/wappalyzer",
    timeoutMs: 2_000,
    ports,
  });

  const result = await detector.detect("https://example.com/pricing#plans");

  assert.equal(result[0]?.name, "React");
  assert.ok(events.indexOf("telemetry:false") < events.indexOf("goto:https://example.com/pricing"));
  assert.deepEqual(events.slice(-3), [
    "context:close",
    "proxy:close",
    "profile:remove:/tmp/wappalyzer-profile",
  ]);
});

test("cleans up the context, proxy, and profile when detection fails", async () => {
  const events: string[] = [];
  const ports = fixturePorts(events, []);
  ports.launchPersistentContext = async () => {
    events.push("context:launch");
    throw new Error("Chromium unavailable");
  };
  const detector = await createWappalyzerTechnologyDetector({
    extensionPath: "/approved/wappalyzer",
    ports,
  });

  await assert.rejects(
    () => detector.detect("https://example.com/"),
    /Chromium unavailable/,
  );
  assert.deepEqual(events, [
    "profile:create",
    "proxy:create",
    "context:launch",
    "proxy:close",
    "profile:remove:/tmp/wappalyzer-profile",
  ]);
});

test("waits for a stable Wappalyzer result instead of returning a partial batch", async () => {
  const events: string[] = [];
  const aws = {
    name: "Amazon Web Services",
    slug: "amazon-web-services",
    categories: [{ name: "PaaS" }],
    confidence: 100,
    icon: "Amazon Web Services.svg",
  };
  const react = {
    name: "React",
    slug: "react",
    categories: [{ name: "JavaScript libraries" }],
    confidence: 100,
    icon: "React.svg",
  };
  const reads = [[], [aws], [aws, react], [aws, react], [aws, react]];
  const ports = fixturePorts(events, []);
  const launch = ports.launchPersistentContext;
  ports.launchPersistentContext = async (profilePath, options) => {
    const context = await launch(profilePath, options);
    const worker = context.serviceWorkers()[0]!;
    let readIndex = 0;
    worker.evaluate = async (expression: string) => {
      if (expression.includes("tracking")) return undefined;
      const value = reads[Math.min(readIndex, reads.length - 1)]!;
      readIndex += 1;
      return value;
    };
    return context;
  };
  const detector = await createWappalyzerTechnologyDetector({
    extensionPath: "/approved/wappalyzer",
    timeoutMs: 2_000,
    ports,
  });

  const result = await detector.detect("https://example.com/");

  assert.deepEqual(result.map(({ name }) => name), [
    "Amazon Web Services",
    "React",
  ]);
});

test("rejects missing extension configuration", async () => {
  await assert.rejects(
    () => createWappalyzerTechnologyDetector({ extensionPath: " " }),
    /extension path/i,
  );
});

function fixturePorts(
  events: string[],
  detections: unknown[],
): WappalyzerBrowserPorts {
  return {
    createProfile: async () => {
      events.push("profile:create");
      return "/tmp/wappalyzer-profile";
    },
    removeProfile: async (profilePath) => {
      events.push(`profile:remove:${profilePath}`);
    },
    createProxy: async () => {
      events.push("proxy:create");
      return {
        server: "http://127.0.0.1:4321",
        close: async () => {
          events.push("proxy:close");
        },
      };
    },
    launchPersistentContext: async (_profilePath, options) => {
      events.push(`context:launch:${options.extensionPath}`);
      const worker = {
        evaluate: async (expression: string) => {
          if (expression.includes("tracking")) {
            events.push("telemetry:false");
            return undefined;
          }
          events.push("detections:read");
          return detections;
        },
      };
      return {
        serviceWorkers: () => [worker],
        waitForServiceWorker: async () => worker,
        pages: () => [{
          goto: async (url: string) => {
            events.push(`goto:${url}`);
          },
          bringToFront: async () => {
            events.push("page:front");
          },
        }],
        newPage: async () => {
          throw new Error("fixture already has a page");
        },
        close: async () => {
          events.push("context:close");
        },
      };
    },
    delay: async () => undefined,
  };
}
