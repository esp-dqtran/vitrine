import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps Apps and Sites queue declarations mutually exclusive", async () => {
  const [appsQueue, sitesQueue] = await Promise.all([
    readFile(new URL("src/queue.ts", root), "utf8"),
    readFile(new URL("src/sitesQueue.ts", root), "utf8"),
  ]);

  assert.match(appsQueue, /QUEUE_NAME = "mobbin-jobs"/);
  assert.match(appsQueue, /DLQ_NAME = "mobbin-jobs\.dlq"/);
  assert.doesNotMatch(appsQueue, /mobbin-sites-jobs|import-site/);
  assert.match(sitesQueue, /SITES_QUEUE_NAME = "mobbin-sites-jobs"/);
  assert.match(sitesQueue, /SITES_DLQ_NAME = "mobbin-sites-jobs\.dlq"/);
  assert.doesNotMatch(sitesQueue, /consumeJobs|from "\.\/queue\.ts"/);
});

test("keeps worker consumers, progress, and cancellation isolated", async () => {
  const [appsWorker, sitesWorker, sitesPipeline] = await Promise.all([
    readFile(new URL("services/import-worker/src/index.ts", root), "utf8"),
    readFile(new URL("services/sites-import-worker/src/index.ts", root), "utf8"),
    readFile(new URL("services/sites-import-worker/src/pipeline.ts", root), "utf8"),
  ]);

  assert.match(appsWorker, /consumeJobs/);
  assert.doesNotMatch(appsWorker, /consumeSitesJobs|sitesQueue|MOBBIN_SITES_/);
  assert.match(sitesWorker, /consumeSitesJobs/);
  assert.match(sitesWorker, /MOBBIN_SITES_PROFILE_DIR/);
  assert.match(sitesWorker, /MOBBIN_SITES_STORAGE_STATE_PATH/);
  assert.doesNotMatch(`${sitesWorker}\n${sitesPipeline}`, /\bconsumeJobs\b|\brequestCancel\b|progress\.ts|cancel-requested/);
});

test("launches both workers against one RabbitMQ with distinct browser state", async () => {
  const [compose, appsDockerfile, sitesDockerfile, packageSource] = await Promise.all([
    readFile(new URL("docker-compose.yml", root), "utf8"),
    readFile(new URL("services/import-worker/Dockerfile", root), "utf8"),
    readFile(new URL("services/sites-import-worker/Dockerfile", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  const apps = serviceBlock(compose, "import-worker");
  const sites = serviceBlock(compose, "sites-import-worker");
  const parsedPackage = JSON.parse(packageSource) as { scripts: Record<string, string> };

  assert.match(apps, /dockerfile: services\/import-worker\/Dockerfile/);
  assert.match(sites, /dockerfile: services\/sites-import-worker\/Dockerfile/);
  assert.match(apps, /RABBITMQ_URL: amqp:\/\/rabbitmq/);
  assert.match(sites, /RABBITMQ_URL: amqp:\/\/rabbitmq/);
  assert.match(apps, /rabbitmq:\s*\n\s+condition: service_healthy/);
  assert.match(sites, /rabbitmq:\s*\n\s+condition: service_healthy/);
  assert.match(apps, /import-worker-profile:\/app\/browser-profile/);
  assert.doesNotMatch(apps, /sites-import-worker-profile|MOBBIN_SITES_/);
  assert.match(sites, /sites-import-worker-profile:\/app\/browser-profile/);
  assert.doesNotMatch(sites, /\n\s+- import-worker-profile:|MOBBIN_PROFILE_DIR:/);
  assert.match(sites, /MOBBIN_SITES_STORAGE_STATE_PATH: \/app\/secrets\/mobbin-storage-state\.json/);
  assert.match(appsDockerfile, /services\/import-worker\/src\/index\.ts/);
  assert.doesNotMatch(appsDockerfile, /sites-import-worker/);
  assert.match(sitesDockerfile, /services\/sites-import-worker\/src\/index\.ts/);
  assert.doesNotMatch(sitesDockerfile, /services\/import-worker\/src\/index\.ts/);
  assert.equal(parsedPackage.scripts["service:sites-import-worker"], "tsx services/sites-import-worker/src/index.ts");
  assert.match(parsedPackage.scripts.test, /services\/sites-import-worker\/src\/\*\.test\.ts/);
});

function serviceBlock(compose: string, name: string): string {
  const match = new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-zA-Z0-9-]+:|^volumes:)`, "m").exec(compose);
  assert.ok(match, `missing ${name} service`);
  return match[0];
}
