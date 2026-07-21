import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps all three RabbitMQ job types mutually exclusive", async () => {
  const [appsQueue, sitesQueue, publicQueue] = await Promise.all([
    readFile(new URL("src/queue.ts", root), "utf8"),
    readFile(new URL("src/sitesQueue.ts", root), "utf8"),
    readFile(new URL("src/publicPageQueue.ts", root), "utf8"),
  ]);

  assert.doesNotMatch(appsQueue, /public-page-jobs|crawl-public-page/);
  assert.doesNotMatch(sitesQueue, /public-page-jobs|crawl-public-page/);
  assert.match(publicQueue, /PUBLIC_PAGE_QUEUE_NAME = "public-page-jobs"/);
  assert.match(publicQueue, /PUBLIC_PAGE_DLQ_NAME = "public-page-jobs\.dlq"/);
  assert.doesNotMatch(publicQueue, /mobbin-jobs|mobbin-sites-jobs|consumeSitesJobs|consumeJobs/);
});

test("public-page worker owns only generic browser crawl dependencies", async () => {
  const [appsWorker, sitesWorker, publicWorker, publicPipeline] = await Promise.all([
    readFile(new URL("services/import-worker/src/index.ts", root), "utf8"),
    readFile(new URL("services/sites-import-worker/src/index.ts", root), "utf8"),
    readFile(new URL("services/public-page-import-worker/src/index.ts", root), "utf8"),
    readFile(new URL("services/public-page-import-worker/src/pipeline.ts", root), "utf8"),
  ]);

  assert.doesNotMatch(appsWorker, /consumePublicPageJobs|publicPageQueue/);
  assert.doesNotMatch(sitesWorker, /consumePublicPageJobs|publicPageQueue/);
  assert.match(publicWorker, /consumePublicPageJobs/);
  assert.match(publicWorker, /createPublicPageBrowser/);
  assert.match(publicWorker, /crawlPublicPage/);
  assert.doesNotMatch(
    `${publicWorker}\n${publicPipeline}`,
    /MOBBIN_|storage-state|consumeSitesJobs|\bconsumeJobs\b|progress\.ts|cancel-requested/,
  );
});

test("compose launches the public-page worker on shared RabbitMQ without Mobbin secrets", async () => {
  const [compose, dockerfile, packageSource] = await Promise.all([
    readFile(new URL("docker-compose.yml", root), "utf8"),
    readFile(new URL("services/public-page-import-worker/Dockerfile", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  const service = serviceBlock(compose, "public-page-import-worker");
  const parsedPackage = JSON.parse(packageSource) as { scripts: Record<string, string> };

  assert.match(service, /dockerfile: services\/public-page-import-worker\/Dockerfile/);
  assert.match(service, /RABBITMQ_URL: amqp:\/\/rabbitmq/);
  assert.match(service, /rabbitmq:\s*\n\s+condition: service_healthy/);
  assert.doesNotMatch(service, /MOBBIN_|mobbin-storage-state|browser-profile/);
  assert.match(dockerfile, /services\/public-page-import-worker\/src\/index\.ts/);
  assert.doesNotMatch(dockerfile, /sites-import-worker|services\/import-worker/);
  assert.equal(
    parsedPackage.scripts["service:public-page-import-worker"],
    "tsx services/public-page-import-worker/src/index.ts",
  );
  assert.match(parsedPackage.scripts.test, /services\/public-page-import-worker\/src\/\*\.test\.ts/);
});

function serviceBlock(compose: string, name: string): string {
  const match = new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-zA-Z0-9-]+:|^volumes:)`, "m").exec(compose);
  assert.ok(match, `missing ${name} service`);
  return match[0];
}
