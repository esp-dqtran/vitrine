import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of ["dist/client/index.html", "worker/index.js", ".openai/hosting.json"]) if (!existsSync(resolve(root, file))) throw new Error(`Missing ${file}`);
mkdirSync(resolve(root, "dist/server"), { recursive: true });
mkdirSync(resolve(root, "dist/.openai"), { recursive: true });
copyFileSync(resolve(root, "worker/index.js"), resolve(root, "dist/server/index.js"));
copyFileSync(resolve(root, ".openai/hosting.json"), resolve(root, "dist/.openai/hosting.json"));
