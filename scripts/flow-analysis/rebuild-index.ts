import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

type Artifact = {
  source: {
    platform: "ios" | "android" | "web";
    title: string;
  };
};

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const app = argument("--app") ?? process.env.FLOW_APP ?? "amazon-shopping";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app)) throw new Error("Invalid --app");
  const product = argument("--product") ?? process.env.FLOW_PRODUCT ??
    app.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
  const root = resolve(
    argument("--root") ??
      join(process.cwd(), "data", "feature-descriptions", app),
  );
  const files = (await readdir(join(root, "json")))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const rows: Array<{ platform: string; title: string; file: string }> = [];
  for (const file of files) {
    const artifact = JSON.parse(
      await readFile(join(root, "json", file), "utf8"),
    ) as Artifact;
    const markdown = file.replace(/\.json$/, ".md");
    await access(join(root, "markdown", markdown));
    rows.push({
      platform: artifact.source.platform,
      title: artifact.source.title,
      file: markdown,
    });
  }
  const progress = JSON.parse(
    await readFile(join(root, "progress.json"), "utf8"),
  ) as { total?: number; completed?: number };
  const total = progress.total ?? rows.length;
  const completed = progress.completed ?? rows.length;
  if (completed !== rows.length || total !== rows.length) {
    throw new Error(
      `Artifact inventory ${rows.length} does not match progress ${completed}/${total}`,
    );
  }
  const markdown = [
    `# ${product} flow feature descriptions`,
    "",
    "Generated from the complete ordered screenshot evidence for each flow.",
    "",
    `Completed: ${completed}/${total}`,
    "",
    ...rows.map(({ platform, title, file }) =>
      `- [${platform} · ${title}](markdown/${file})`
    ),
    "",
  ].join("\n");
  await writeFile(join(root, "README.md"), markdown, "utf8");
  console.log(JSON.stringify({ app, completed, total, index: join(root, "README.md") }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
