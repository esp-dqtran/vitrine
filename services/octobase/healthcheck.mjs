const base = process.env.OCTOBASE_URL ?? "http://127.0.0.1:3020";
const response = await fetch(`${base}/api/healthz`);
if (!response.ok) {
  throw new Error(`OctoBase health check returned ${response.status}`);
}
console.log("OctoBase health check passed");
