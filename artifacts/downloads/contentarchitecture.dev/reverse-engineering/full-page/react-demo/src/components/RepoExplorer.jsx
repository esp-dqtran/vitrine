import {
  CaretRight,
  File,
  FileCode,
  FileMd,
  Folder,
  FolderOpen,
  GitCommit,
  MagnifyingGlass,
  TerminalWindow,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";

const NEXT_README = `# The Content Architecture (Next.js)

A modern Next.js 16.3 starter with Sanity CMS integration.

## Features

- Next.js 16.3 with App Router and Server Components
- Sanity CMS with in-app Studio
- TypeScript 6, Tailwind CSS 4, and Biome
- Reusable components, page builder sections, and rich text blocks
- **Cache Components** ([the modern Next.js caching model](https://nextjs.org/docs/app/getting-started/cache-components)): every page prerenders into a static shell with a one-year lifetime, and publishing in the Studio is the only revalidation signal (webhook + tags, no timers). See [\`docs/sanity/revalidation-and-caching.md\`](docs/sanity/revalidation-and-caching.md).
- Draft mode with Sanity Live, Visual Editing, and SEO helpers
- **HTTP Basic Auth (optional)** — \`proxy.ts\` gates the site or individual URLs using **\`BASIC_AUTH_*\` environment variables** and **CMS toggles** (Settings → Security, per-entry “Password protect”). See [\`docs/features/basic-auth.md\`](docs/features/basic-auth.md).
- Feature modules for redirects, Umami analytics, and spam prevention
- **llms.txt for AI assistants**: an editable, AI-generated [\`/llms.txt\`](https://llmstxt.org) drafted from your content with Sanity Agent Actions (Site, Agents tab). See [\`docs/features/llms-txt.md\`](docs/features/llms-txt.md).
- **Agent Markdown (content negotiation)**: pages and articles serve a token-light Markdown version to agents that send \`Accept: text/markdown\`, on the same URL. Generated and stored per page from the Agents tab (one click), then served verbatim. See [\`docs/features/agent-markdown.md\`](docs/features/agent-markdown.md).
- Scaffolding via Plop for repeatable section/block generation
- Starter **seed dataset** (\`seed/\`), imported by \`npm run sanity:project-setup\` so a new project boots with example content
- [\`@mantine/hooks\`](https://mantine.dev/hooks/getting-started/) for shared React hooks; \`features/dom/use-breakpoint.ts\` wraps [\`useMediaQuery\`](https://mantine.dev/hooks/use-media-query/) for Tailwind-aligned breakpoints and touch detection, alongside \`constants\` / \`parseResponsiveValues\`

## Getting Started

**New here? Start with [\`GETTING-STARTED.md\`](GETTING-STARTED.md).** It is the guided, top to bottom path from a fresh clone to your first rendered section. The sections below are the reference.

### Prerequisites

- Node.js 24.15.0, pinned in \`.nvmrc\` and in \`package.json\` (\`engines\`, \`volta\`). \`engines\` requires the \`^24.15.0\` LTS line, so npm refuses to install on any other major.
- npm >= 11.6.2

### Installation

\`\`\`bash
npm install
\`\`\`

### Environment Variables

Create a \`.env\` file and add at least:

\`\`\`env
SANITY_API_VIEW_TOKEN=your-view-token
SANITY_API_EDIT_TOKEN=your-edit-token
SANITY_REVALIDATE_SECRET=your-revalidate-secret
NEXT_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_PROJECT_ID=your-project-id
NEXT_PUBLIC_SANITY_API_VERSION=2025-02-19
NEXT_PUBLIC_SANITY_STUDIO_BASE_PATH=/studio
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

    npm install
    npm run setup
    npm run dev

Open http://localhost:3000 and start building the actual project.

## Commands

    npm run dev          Start Next.js and the embedded Studio
    npm run build        Create the production build
    npm run lint         Run Biome and TypeScript checks
    npm run test         Run the application test suite

## Project structure

    app/                 Routes, metadata, API, and Studio
    components/          Shared visual primitives
    features/            Self-contained production features
    sanity/              Schema, queries, and Studio structure
    scripts/             Setup, migration, and maintenance tools

## Docs

Feature-level docs now live in \`docs/\` so the root README stays lightweight.

- Documentation hub: \`docs/README.md\`
- Sanity setup overview: \`docs/sanity/README.md\`
- HTTP Basic Auth: \`docs/features/basic-auth.md\`
- Redirects: \`docs/features/redirects.md\`
- Code generation: \`docs/features/code-generation.md\`
- Spam prevention: \`docs/features/spam-prevention.md\`
- Animated content: \`docs/features/animated-content.md\`
- Contact form notifications: \`docs/features/contact-form-notifications.md\`
- Umami tracking: \`docs/features/umami-tracking.md\`
- llms.txt and AI agents: \`docs/features/llms-txt.md\`
- Agent Markdown: \`docs/features/agent-markdown.md\`
- Git hooks: \`docs/features/git-hooks.md\`
- Agent skills: \`docs/features/agent-skills.md\`
- Dataset migration: \`docs/sanity/dataset-migration.md\`
- Seed dataset: \`docs/sanity/seed-dataset.md\`
- Sanity project setup: \`docs/sanity/project-setup.md\`

## Scripts

- \`npm run dev\`: Start development server
- \`npm run build\`: Build for production
- \`npm run start\`: Start production server
- \`npm run check\`: Run all checks in parallel
- \`npm test\`: Run the unit tests
- \`npm run plop\`: Scaffold new sections and rich text blocks
- \`npm run clear\`: Remove local build and cache output

## License

One license covers one developer or one studio team.
See GET-ACCESS.md for the complete terms and current pricing.`;

const ASTRO_README = `# The Content Architecture (Astro)

A modern Astro 7 starter with Sanity CMS integration. The Astro edition of
the-content-architecture: the same content model, the same Studio, the same
product features, on an Astro frontend.

## Features

- Astro 7 in SSR mode on Vercel: pages render on demand, with the embedded Studio
  and API endpoints on the same origin
- Sanity CMS with the Studio embedded at \`/studio\`
- The pages model: a catch-all route renders any \`page\` document by its \`uri\`,
  homepage included
- Reusable page builder (text, media, CTA, contact form) rendered by self-fetching
  \`.astro\` components, each fetching its own slice by \`docId\` + \`sectionKey\`
- Tag-based route caching: pages declare their tags, the publish webhook invalidates
  them, and the same model moves to the CDN by swapping one provider
- No React on public pages: client behavior is a custom element with lazy hydration.
  React ships only inside the Studio
- Rich text via Portable Text with media blocks, inline media, links, colors
- Media pipeline: Sanity images (responsive srcset + LQIP), Mux video, native video,
  Lottie, and Rive
- Draft mode with the Presentation tool and Visual Editing overlays
- SEO helpers: per-page metadata with Site singleton fallbacks, og:image cropping,
  JSON-LD, CMS-driven sitemap and robots
- **HTTP Basic Auth (optional):** \`src/middleware.ts\` gates the site or individual
  URLs using \`BASIC_AUTH_*\` environment variables and CMS toggles.
  See [\`docs/features/basic-auth.md\`](docs/features/basic-auth.md).
- **llms.txt for AI assistants:** an editable, AI-generated \`/llms.txt\` drafted from
  your content with Sanity Agent Actions.
  See [\`docs/features/llms-txt.md\`](docs/features/llms-txt.md).
- **Agent Markdown (content negotiation):** pages and articles serve a token-light
  Markdown version to agents that send \`Accept: text/markdown\`, on the same URL.
  See [\`docs/features/agent-markdown.md\`](docs/features/agent-markdown.md).
- CMS-managed redirects baked into the build from the Settings singleton
- Scaffolding via Plop for repeatable section/route/block generation
- Starter **seed dataset** (\`seed/\`) so a new project boots with example content
- Contact form with honeypot + timing spam prevention and Resend notifications

## Getting Started

**New here? Start with [\`GETTING-STARTED.md\`](GETTING-STARTED.md).** It is the guided,
top to bottom path from a fresh clone to your first rendered section. The sections
below are the reference.

### Prerequisites

- Node.js 24.15.0, pinned in \`.nvmrc\` and in \`package.json\` (\`engines\`, \`volta\`).
  \`engines\` requires the \`^24.15.0\` LTS line, so npm refuses to install on any other
  major. This matches the Next.js edition of the project.
- npm >= 11.6.2

### Installation

\`\`\`bash
npm install
\`\`\`

### Environment Variables

Copy \`.env.example\` to \`.env\` and fill it in. The minimum for local dev:

\`\`\`env
PUBLIC_SITE_URL=http://localhost:4321
PUBLIC_SANITY_PROJECT_ID=your-project-id
PUBLIC_SANITY_DATASET=production
PUBLIC_SANITY_API_VERSION=2025-02-19
PUBLIC_SANITY_STUDIO_BASE_PATH=/studio
SANITY_API_VIEW_TOKEN=your-view-token
SANITY_API_EDIT_TOKEN=your-edit-token
\`\`\`

\`npm run sanity:project-setup\` creates the project, both tokens, CORS entries, and
writes \`.env\` for you.

### Development

\`\`\`bash
npm run dev
\`\`\`

- Site: [http://localhost:4321](http://localhost:4321)
- Studio: \`http://localhost:4321\` + your \`PUBLIC_SANITY_STUDIO_BASE_PATH\`

### Build

\`\`\`bash
npm run build
\`\`\`

The build targets Vercel: push the connected repo or run \`vercel deploy\`.

## Scripts

- \`npm run dev\`: Start development server
- \`npm run build\`: Build for Vercel
- \`npm run check\`: Every check in parallel (\`check.types\` + \`check.biome\`)
- \`npm run check.types\`: Typecheck \`.astro\` and \`.ts\` together (\`astro check\`)
- \`npm run check.biome\`: Biome lint
- \`npm run format\`: Format with Biome
- \`npm run sanity:typegen\`: Generate Sanity types
- \`npm run plop\`: Scaffold new sections, routes, and rich text blocks
- \`npm run sanity:dataset-import\`: Import a dataset backup or the bundled seed content
- \`npm run sanity:project-setup\`: Wizard for project, tokens, CORS, webhook, and \`.env\`

## Project Structure

\`\`\`text
.
|-- src/
|   |-- pages/       # Astro routes ([...uri].astro is the pages model) + api/
|   |-- layouts/     # Web.astro: head, SEO, JSON-LD, transitions
|   |-- components/  # Shared UI (.astro + paired custom elements)
|   |-- features/    # Feature modules, mirroring the Next.js edition
|   |-- sanity/      # loadQuery, queries, seo, media, rich text
|   |-- styles/      # Tailwind v4 tokens and global styles
|   +-- middleware.ts
|-- sanity/          # The Studio: schema, structure, inputs (standalone folder)
|-- scripts/         # Dataset and project-setup CLIs
|-- seed/            # Bundled starter content (dataset export)
|-- docs/            # Project documentation
+-- astro.config.mjs # SSR, env schema, cache provider, integrations
\`\`\`

## Agent Skills

AI guidance for this repository lives in \`AGENTS.md\` and \`.agents/skills/\`.

## License

Commercial, one license per buyer. Build unlimited personal, commercial, and client projects with it, and sell what you build. Do not resell or republish the boilerplate itself.

See LICENSE.md for the full terms, and the Terms of Service for the purchase terms.
`;

const FILE_CONTENTS = {
  "README.md": NEXT_README,
  "AGENTS.md": `# THE CONTENT ARCHITECTURE / AGENTS

The orchestration layer for agentic tools. Read this before changing the project.

## WORKFLOW

1. Scope first: the smallest set of files to change.
2. Reuse existing sections and field factories before adding new ones.
3. Run npm run sanity:typegen after any schema change.
4. Source of truth is the code, not the docs.`,
  "package.json": `{
  "name": "the-content-architecture-next-js",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "check": "concurrently npm:check.*",
    "plop": "plop"
  }
}`,
  "env.ts": `import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  emptyStringAsUndefined: true,
  client: { NEXT_PUBLIC_URL: z.url() },
});`,
};

const file = (name, content = FILE_CONTENTS[name]) => ({ type: "file", name, content: content ?? `// ${name}\n\n// Included in The Content Architecture Next.js repository.\n` });
const folder = (name, children = []) => ({ type: "folder", name, children });

const NEXT_TREE = folder("the-content-architecture-next-js", [
  folder(".agents", [folder("skills", [folder("sanity"), folder("frontend"), folder("design-engineering")])]),
  folder(".husky", [folder("_", [file("pre-commit"), file("prepare-commit-msg")])]),
  folder(".zed"),
  folder("app", [
    folder("(web)", [folder("[[...uri]]", [file("page.tsx")]), file("layout.tsx")]),
    folder("api", [folder("revalidate", [file("route.ts")]), folder("draft-mode")]),
    folder("favicon.ico"), folder("llms.txt"), folder("robots.txt", [file("route.ts")]), folder("sanity-studio"),
    file("global-not-found.tsx"), file("not-found.tsx"), file("shared-web-layout.tsx"), file("sitemap.ts"),
  ]),
  folder("components", [file("button.tsx"), file("link.tsx"), file("image.tsx"), file("animated-text.tsx")]),
  folder("docs", [file("README.md", "# Docs\n\nFeature and Sanity docs hub.\n"), folder("features"), folder("sanity")]),
  folder("features", [folder("agents"), folder("api"), folder("auth"), folder("blog"), folder("dom"), folder("draft-mode"), folder("fonts"), folder("legal"), folder("motion"), folder("mux"), folder("page-builder"), folder("rich-text"), folder("sanity"), folder("site"), folder("spam-prevention"), folder("style"), folder("umami"), folder("utils"), folder("view-transition"), file("lenis.tsx"), file("use-content-ready.ts")]),
  folder("public"), folder("sanity"), folder("scripts"), folder("seed"), folder("templates"),
  file(".env.example"), file(".gitignore"), file(".lefthookrc"), file(".mcp.json"), file(".npmrc"), file(".nvmrc"),
  file("AGENTS.md"), file("assets.d.ts"), file("biome.jsonc"), file("CLAUDE.md"), file("commitlint.config.mjs"),
  file("env.ts"), file("GETTING-STARTED.md"), file("lefthook.yml"), file("LICENSE.md"), file("next.config.ts"),
  file("package-lock.json"), file("package.json"), file("plopfile.mjs"), file("proxy.ts"), file("README.md", NEXT_README),
  file("sanity-schema.json"), file("sanity.cli.ts"), file("sanity.config.ts"), file("skills-lock.json"), file("tsconfig.json"),
]);

const ASTRO_TREE = folder("the-content-architecture-astro", [
  folder(".agents", [folder("skills", [folder("sanity"), folder("frontend"), folder("design-engineering")])]),
  folder(".vscode"), folder(".zed"), folder("docs"), folder("public"), folder("sanity"), folder("scripts"), folder("seed"),
  folder("src", [
    folder("components"), folder("features", [folder("agents"), folder("auth"), folder("page-builder"), folder("sanity"), folder("site"), folder("spam-prevention")]),
    folder("layouts"), folder("lib"), folder("pages", [file("[...uri].astro"), file("404.astro"), file("sitemap.xml.ts")]),
    folder("sanity"), folder("styles"), file("env.d.ts"), file("middleware.ts"),
  ]),
  folder("templates"), file(".env.example"), file(".gitignore"), file(".lefthookrc"), file(".mcp.json"), file(".npmrc"), file(".nvmrc"),
  file("AGENTS.md"), file("astro.config.mjs"), file("biome.jsonc"), file("CLAUDE.md"), file("GETTING-STARTED.md"), file("lefthook.yml"), file("LICENSE.md"),
  file("package-lock.json"), file("package.json", FILE_CONTENTS["package.json"].replace("next-js", "astro").replace("next dev", "astro dev").replace("next build", "astro build")),
  file("plopfile.mjs"), file("README.md", ASTRO_README), file("sanity.cli.ts"), file("sanity.config.ts"),
  file("sanity-schema.json"), file("skills-lock.json"), file("tsconfig.json"),
]);

const PINNED_FILES = [];
const COMMIT_WEEKS = [0, 0, 1, 1, 2, 3, 4, 2, 1, 3, 5, 3, 2, 4, 6, 4, 3, 2, 5, 7, 6, 4, 3, 5, 4, 7];
const COMMANDS = ["help", "ls", "cd", "tree", "cat", "open", "grep", "plop", "history", "pwd", "whoami", "echo", "clear", "git"];

function flattenFiles(node, path = node.name, result = []) {
  if (node.type === "folder") node.children.forEach((child) => flattenFiles(child, `${path}/${child.name}`, result));
  else result.push({ name: node.name, path, node });
  return result;
}

const TOKEN_RULES = {
  markdown: [
    ["fence", /```[\s\S]*?```/y], ["heading", /#{1,6} [^\n]*/y], ["string", /`[^`\n]+`/y],
    ["type", /\*\*[^*\n]+\*\*|__[^_\n]+__/y], ["punctuation", /[-*+](?= )|>(?= )/y],
  ],
  code: [
    ["comment", /\/\/[^\n]*/y], ["comment", /\/\*[\s\S]*?\*\//y], ["string", /`(?:\\[\s\S]|[^`\\])*`/y],
    ["property", /"(?:\\.|[^"\\\n])*"(?=\s*:)/y], ["string", /"(?:\\.|[^"\\\n])*"/y], ["string", /'(?:\\.|[^'\\\n])*'/y],
    ["number", /\b\d[\d_]*(?:\.\d+)?\b/y], ["keyword", /\b(?:const|let|var|function|return|if|else|for|while|new|class|interface|type|import|export|from|default|async|await|null|undefined|true|false|as|in|of)\b/y],
    ["type", /\b[A-Z][A-Za-z0-9_$]*\b/y], ["func", /\b[a-zA-Z_$][\w$]*(?=\s*\()/y], ["punctuation", /[{}()[\].,;:?=+\-*/%<>!&|^~@]/y],
  ],
};

function languageFor(name) {
  if (/^(README|CHANGELOG)$|\.(md|mdx)$/.test(name)) return "markdown";
  if (/\.(ts|tsx|js|jsx|mjs|cjs|json|jsonc|hbs)$/.test(name)) return "code";
  return "plain";
}

function highlight(value, language) {
  const rules = TOKEN_RULES[language];
  if (!rules) return [{ type: "plain", value }];
  const tokens = [];
  let position = 0;
  let plainStart = 0;
  while (position < value.length) {
    let matched = false;
    for (const [type, regex] of rules) {
      regex.lastIndex = position;
      const match = regex.exec(value);
      if (!match?.[0]) continue;
      if (plainStart < position) tokens.push({ type: "plain", value: value.slice(plainStart, position) });
      tokens.push({ type, value: match[0] });
      position += match[0].length;
      plainStart = position;
      matched = true;
      break;
    }
    if (!matched) position += 1;
  }
  if (plainStart < value.length) tokens.push({ type: "plain", value: value.slice(plainStart) });
  return tokens;
}

function FileGlyph({ name }) {
  if (/\.(md|mdx|txt)$/.test(name)) return <FileMd aria-hidden="true" />;
  if (/\.(ts|tsx|js|jsx|mjs|json|jsonc|css)$/.test(name)) return <FileCode aria-hidden="true" />;
  return <File aria-hidden="true" />;
}

function TreeNode({ node, path, depth, activePath, openPaths, onOpen, onToggle }) {
  if (node.type === "folder") {
    const open = openPaths.has(path);
    return <li>
      <button type="button" className="repo-tree-row" style={{ "--depth": depth }} aria-expanded={open} onClick={() => onToggle(path)}>
        <CaretRight className="repo-tree-row__caret" weight="bold" aria-hidden="true" />
        {open ? <FolderOpen aria-hidden="true" /> : <Folder aria-hidden="true" />}<span>{node.name}</span>
      </button>
      <div className="repo-tree-children" data-open={open}><ul>{node.children.map((child) => <TreeNode key={child.name} node={child} path={`${path}/${child.name}`} depth={depth + 1} activePath={activePath} openPaths={openPaths} onOpen={onOpen} onToggle={onToggle} />)}</ul></div>
    </li>;
  }
  return <li><button type="button" className={`repo-tree-row${activePath === path ? " is-selected" : ""}`} style={{ "--depth": depth }} aria-current={activePath === path ? "true" : undefined} onClick={() => onOpen(path, node)}>
    <span className="repo-tree-row__spacer" aria-hidden="true" /><FileGlyph name={node.name} /><span>{node.name}</span>
  </button></li>;
}

function CodeEditor({ activePath, fileName, value, onChange }) {
  const textareaRef = useRef(null);
  const numbersRef = useRef(null);
  const highlightRef = useRef(null);
  const minimapRef = useRef(null);
  const viewportRef = useRef(null);
  const draggingRef = useRef(false);
  const lines = value.split("\n");
  const tokens = useMemo(() => highlight(value, languageFor(fileName)), [fileName, value]);
  const mapLines = useMemo(() => lines.map((line) => ({ indent: line.length - line.trimStart().length, length: line.trimStart().length })), [lines]);
  const minimapLineHeight = Math.min(4, Math.max(1, 352 / Math.max(lines.length, 1)));
  const minimapHeight = minimapLineHeight * lines.length;

  function syncScroll() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (numbersRef.current) numbersRef.current.scrollTop = textarea.scrollTop;
    if (highlightRef.current) { highlightRef.current.scrollTop = textarea.scrollTop; highlightRef.current.scrollLeft = textarea.scrollLeft; }
    if (viewportRef.current) {
      const top = textarea.scrollHeight ? textarea.scrollTop / textarea.scrollHeight * minimapHeight : 0;
      const height = textarea.scrollHeight ? textarea.clientHeight / textarea.scrollHeight * minimapHeight : minimapHeight;
      viewportRef.current.style.transform = `translateY(${top}px)`;
      viewportRef.current.style.height = `${height}px`;
    }
  }

  function scrollFromMinimap(clientY) {
    const map = minimapRef.current;
    const textarea = textareaRef.current;
    if (!map || !textarea || minimapHeight <= 0) return;
    const position = (clientY - map.getBoundingClientRect().top) / minimapHeight * textarea.scrollHeight - textarea.clientHeight / 2;
    textarea.scrollTop = Math.max(0, Math.min(position, textarea.scrollHeight - textarea.clientHeight));
  }

  useEffect(syncScroll, [value, minimapHeight]);

  if (!activePath) return <div className="repo-editor-empty">// select a file to open it</div>;
  return <div className="repo-editor"><header>{fileName}</header><div className="repo-editor__surface">
    <div ref={numbersRef} className="repo-editor__numbers" aria-hidden="true"><pre>{lines.map((_, index) => index + 1).join("\n")}</pre></div>
    <div className="repo-editor__code"><pre ref={highlightRef} className="repo-editor__highlight" aria-hidden="true">{tokens.map((token, index) => <span key={index} className={token.type === "plain" ? undefined : `token-${token.type}`}>{token.value}</span>)}</pre><textarea ref={textareaRef} aria-label={`${fileName} contents`} value={value} wrap="off" spellCheck="false" autoCapitalize="off" autoCorrect="off" onChange={(event) => onChange(event.target.value)} onScroll={syncScroll} /></div>
    <div className="repo-editor__minimap"><button ref={minimapRef} type="button" aria-label="Scroll via minimap" style={{ height: minimapHeight }} onPointerDown={(event) => { draggingRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); scrollFromMinimap(event.clientY); }} onPointerMove={(event) => draggingRef.current && scrollFromMinimap(event.clientY)} onPointerUp={(event) => { draggingRef.current = false; event.currentTarget.releasePointerCapture(event.pointerId); }}>
      {mapLines.map((line, index) => <i key={index} style={{ height: minimapLineHeight, paddingLeft: line.indent * .5 }}><b style={{ width: Math.min(line.length * .5, 52), height: Math.max(1, minimapLineHeight - 1) }} /></i>)}<span ref={viewportRef} aria-hidden="true" />
    </button></div>
  </div></div>;
}

function commitGraph() {
  const glyphs = ["·", "░", "▒", "▓", "█"];
  const max = Math.max(...COMMIT_WEEKS);
  const columns = COMMIT_WEEKS.map((value) => ({ height: value ? Math.max(1, Math.round(value / max * 7)) : 0, glyph: glyphs[value / max > .75 ? 4 : value / max > .5 ? 3 : value / max > .25 ? 2 : value ? 1 : 0] }));
  return Array.from({ length: 7 }, (_, row) => columns.map((column) => column.height >= 7 - row ? column.glyph : "·").join(""));
}

function RepositoryTerminal({ gitRequest, onOpenFile, repoName, totalCommits, tree }) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!gitRequest) return;
    setEntries((current) => [...current, { command: "git", output: [`main · Updated today · ${totalCommits} commits`, "", ...commitGraph(), "", "less ·░▒▓█ more   (last 26 weeks · commit volume, not contents)"] }]);
  }, [gitRequest, totalCommits]);

  function run(command) {
    const trimmed = command.trim();
    if (!trimmed) return;
    const [name, ...args] = trimmed.split(/\s+/);
    let output = [];
    if (name === "clear") setEntries([]);
    else if (name === "help") output = [`commands: ${COMMANDS.join(", ")}`, "tab completes paths, up/down recalls history"];
    else if (name === "git") output = [`main · Updated today · ${totalCommits} commits`, "", ...commitGraph(), "", "less ·░▒▓█ more   (last 26 weeks · commit volume, not contents)"];
    else if (name === "ls") output = tree.children.map((node) => `${node.name}${node.type === "folder" ? "/" : ""}`);
    else if (name === "tree") output = [".", ...tree.children.slice(0, 16).map((node, index, array) => `${index === array.length - 1 ? "└──" : "├──"} ${node.name}${node.type === "folder" ? "/" : ""}`), "", "15 directories, 33 files"];
    else if (name === "pwd") output = ["/home/edo"];
    else if (name === "whoami") output = ["edo"];
    else if (name === "echo") output = [args.join(" ")];
    else if (name === "history") output = history.map((item, index) => `${String(index + 1).padStart(4, " ")}  ${item}`);
    else if (name === "cat") output = [(FILE_CONTENTS[args[0]] ?? `${args[0]}: No such file or directory`)];
    else if (name === "open" && FILE_CONTENTS[args[0]]) { output = [`opening ${args[0]}`]; onOpenFile(args[0]); }
    else if (name === "cd") output = args.length ? [`cd: ${args.join(" ")}: No such file or directory`] : [];
    else if (name === "plop") output = ["? Select a generator › Page Builder Section", "scaffolding is ready in the purchased repository"];
    else output = [`${name}: command not found. Try help`];
    if (name !== "clear") setEntries((current) => [...current, { command: trimmed, output }]);
    setHistory((current) => [...current, trimmed]);
    setInput("");
    setCursor(null);
  }

  return <section className="repo-terminal" aria-label="Terminal"><header>Terminal</header><div className="repo-terminal__output">
    {entries.map((entry, index) => <div key={index}><p><span>~ </span>{entry.command}</p>{entry.output.map((line, lineIndex) => <pre key={lineIndex}>{line || " "}</pre>)}</div>)}
    <a href="#pricing"><span>~/{repoName} &gt; </span>get-access <em># €549 · one-time</em></a>
    <form onSubmit={(event) => { event.preventDefault(); run(input); }}><span>~/{repoName} &gt;&nbsp;</span><input aria-label="Terminal input" value={input} placeholder={history.length ? undefined : "try: git, ls, tree, plop, cat README.md"} onChange={(event) => { setInput(event.target.value); setCursor(null); }} onKeyDown={(event) => {
      if (event.key === "Enter") { event.preventDefault(); run(input); return; }
      if (event.key === "ArrowUp" && history.length) { event.preventDefault(); const next = cursor === null ? history.length - 1 : Math.max(0, cursor - 1); setCursor(next); setInput(history[next]); }
      if (event.key === "ArrowDown" && cursor !== null) { event.preventDefault(); const next = cursor + 1; if (next >= history.length) { setCursor(null); setInput(""); } else { setCursor(next); setInput(history[next]); } }
      if (event.key === "Tab" && input && !input.includes(" ")) { const matches = COMMANDS.filter((command) => command.startsWith(input)); if (matches.length === 1) { event.preventDefault(); setInput(`${matches[0]} `); } }
    }} /></form>
  </div></section>;
}

function ResizeHandle({ axis, active, label, onPointerDown, onPointerMove, onPointerUp, onKeyDown }) {
  return <button type="button" aria-label={label} className={`repo-resizer repo-resizer--${axis}${active ? " is-active" : ""}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onKeyDown={onKeyDown}><span /></button>;
}

export function RepoExplorer() {
  const rootRef = useRef(null);
  const bodyRef = useRef(null);
  const dragAxis = useRef(null);
  const [edition, setEdition] = useState("next");
  const [openPaths, setOpenPaths] = useState(() => new Set([
    `${NEXT_TREE.name}/app`,
    `${NEXT_TREE.name}/features`,
  ]));
  const readmePath = `${NEXT_TREE.name}/README.md`;
  const [activePath, setActivePath] = useState(readmePath);
  const [contents, setContents] = useState(() => new Map([[readmePath, NEXT_README]]));
  const [explorerWidth, setExplorerWidth] = useState(240);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeResize, setActiveResize] = useState(null);
  const [gitRequest, setGitRequest] = useState(0);
  const tree = edition === "next" ? NEXT_TREE : ASTRO_TREE;
  const totalCommits = edition === "next" ? 119 : 60;
  const files = useMemo(() => [...flattenFiles(tree), ...PINNED_FILES.map((node) => ({ name: node.name, path: node.name, node }))], [tree]);
  const activeEntry = files.find((entry) => entry.path === activePath);
  const activeFile = activeEntry?.name ?? "README.md";
  const activeValue = contents.get(activePath) ?? activeEntry?.node.content ?? "";
  const searchResults = files.filter((entry) => `${entry.name} ${entry.path}`.toLowerCase().includes(searchQuery.trim().toLowerCase())).slice(0, 40);

  useEffect(() => {
    function shortcut(event) {
      if (!rootRef.current?.contains(document.activeElement)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") { event.preventDefault(); setTerminalVisible((value) => !value); }
      if (event.key === "Escape") setSearchOpen(false);
    }
    addEventListener("keydown", shortcut);
    return () => removeEventListener("keydown", shortcut);
  }, []);

  function openFile(path, node) {
    setActivePath(path);
    setContents((current) => current.has(path) ? current : new Map(current).set(path, node.content ?? ""));
    setSearchOpen(false);
  }

  function openNamedFile(name) {
    const entry = files.find((candidate) => candidate.name === name);
    if (entry) openFile(entry.path, entry.node);
  }

  function chooseEdition(nextEdition) {
    const nextTree = nextEdition === "next" ? NEXT_TREE : ASTRO_TREE;
    const nextPath = `${nextTree.name}/README.md`;
    const nextReadme = nextEdition === "next" ? NEXT_README : ASTRO_README;
    setEdition(nextEdition);
    setActivePath(nextPath);
    setContents((current) => current.has(nextPath) ? current : new Map(current).set(nextPath, nextReadme));
    setOpenPaths(() => new Set(nextEdition === "next" ? [`${NEXT_TREE.name}/app`, `${NEXT_TREE.name}/features`] : [`${ASTRO_TREE.name}/src`]));
  }

  function resize(axis, clientX, clientY) {
    const body = bodyRef.current;
    if (!body) return;
    const bounds = body.getBoundingClientRect();
    if (axis === "x" || axis === "xy") setExplorerWidth(Math.max(150, Math.min(clientX - bounds.left, bounds.width * .6)));
    if (axis === "y" || axis === "xy") setTerminalHeight(Math.max(90, Math.min(bounds.bottom - clientY, bounds.height * .7)));
  }

  function pointerStart(axis) { return (event) => { event.preventDefault(); dragAxis.current = axis; setActiveResize(axis); event.currentTarget.setPointerCapture(event.pointerId); }; }
  function pointerMove(event) { if (dragAxis.current) resize(dragAxis.current, event.clientX, event.clientY); }
  function pointerEnd(event) { dragAxis.current = null; setActiveResize(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }
  function resizeKeys(axis) { return (event) => {
    if (axis !== "y" && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); setExplorerWidth((value) => Math.max(150, value + (event.key === "ArrowRight" ? 16 : -16))); }
    if (axis !== "x" && ["ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); setTerminalHeight((value) => Math.max(90, value + (event.key === "ArrowUp" ? 16 : -16))); }
  }; }

  const header = <header className="repo-explorer__bar"><div className="repo-explorer__tabs" role="group" aria-label="Repository edition">
    {["next", "astro"].map((id) => <button key={id} type="button" className={edition === id ? "is-active" : ""} aria-label={`Open the ${id === "next" ? "Next.js" : "Astro"} repository`} aria-pressed={edition === id} onClick={() => chooseEdition(id)}><span>{id === "next" ? "Next.js" : "Astro"}</span></button>)}
  </div><span className="repo-explorer__claim">This is the actual repo.</span><div className="repo-explorer__tools">
    <button type="button" aria-label={terminalVisible ? "Hide terminal" : "Show terminal"} aria-pressed={terminalVisible} onClick={() => setTerminalVisible((value) => !value)}><TerminalWindow aria-hidden="true" /><kbd>⌘ J</kbd></button>
    <button type="button" aria-label="Search files" onClick={() => setSearchOpen(true)}><MagnifyingGlass aria-hidden="true" /><kbd>⌘ K</kbd></button>
  </div></header>;

  return <div className="repo-frame"><section ref={rootRef} className={`repo-explorer${terminalVisible ? "" : " is-terminal-hidden"}${activeResize ? ` is-resizing-${activeResize}` : ""}`} aria-label="Repository explorer" style={{ "--explorer-width": `${explorerWidth}px`, "--terminal-height": `${terminalHeight}px` }}>
    {header}
    <>
      <div ref={bodyRef} className="repo-explorer__body">
        <aside className="repo-explorer__tree"><nav aria-label="File explorer"><div><ul>{tree.children.map((node) => <TreeNode key={node.name} node={node} path={`${tree.name}/${node.name}`} depth={0} activePath={activePath} openPaths={openPaths} onOpen={openFile} onToggle={(path) => setOpenPaths((current) => { const next = new Set(current); next.has(path) ? next.delete(path) : next.add(path); return next; })} />)}
          <li><a className="repo-tree-cta" href="#pricing"><span /><i /><b>GET ACCESS</b></a></li>
        </ul></div><ul className="repo-tree-pinned">{PINNED_FILES.map((node) => <li key={node.name}><button type="button" className={`repo-tree-row${activePath === node.name ? " is-selected" : ""}`} onClick={() => openFile(node.name, node)}><FileGlyph name={node.name} /><span>{node.name}</span></button></li>)}</ul></nav></aside>
        <ResizeHandle axis="x" active={activeResize === "x" || activeResize === "xy"} label="Resize file explorer" onPointerDown={pointerStart("x")} onPointerMove={pointerMove} onPointerUp={pointerEnd} onKeyDown={resizeKeys("x")} />
        <div className="repo-explorer__right"><CodeEditor activePath={activePath} fileName={activeFile} value={activeValue} onChange={(value) => setContents((current) => new Map(current).set(activePath, value))} />
          {terminalVisible ? <><ResizeHandle axis="y" active={activeResize === "y" || activeResize === "xy"} label="Resize terminal" onPointerDown={pointerStart("y")} onPointerMove={pointerMove} onPointerUp={pointerEnd} onKeyDown={resizeKeys("y")} /><div className="repo-terminal-wrap"><RepositoryTerminal gitRequest={gitRequest} onOpenFile={openNamedFile} repoName={tree.name} totalCommits={totalCommits} tree={tree} /></div></> : null}
        </div>
        {terminalVisible ? <button type="button" tabIndex="-1" aria-label="Resize file explorer and terminal" className="repo-corner-resizer" style={{ left: explorerWidth, bottom: terminalHeight }} onPointerDown={pointerStart("xy")} onPointerMove={pointerMove} onPointerUp={pointerEnd} /> : null}
      </div>
      <footer className="repo-explorer__status"><div><span className="repo-branch">⑇ main</span><i /><span><b />Updated today</span></div><button type="button" aria-label="Show the commit graph in the terminal" onClick={() => { setTerminalVisible(true); setGitRequest((value) => value + 1); }}><GitCommit aria-hidden="true" /><span>{totalCommits} commits</span></button></footer>
      {searchOpen ? <div className="repo-explorer__search-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSearchOpen(false)}><section className="repo-explorer__search" role="dialog" aria-modal="true" aria-label="Search project files"><header><MagnifyingGlass aria-hidden="true" /><input autoFocus aria-label="Search project files" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => event.key === "Escape" && setSearchOpen(false)} placeholder="Search project files" /><button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)}><X aria-hidden="true" /></button></header><ul>{searchResults.map((entry) => <li key={entry.path}><button type="button" onClick={() => openFile(entry.path, entry.node)}><FileGlyph name={entry.name} /><span>{entry.name}</span><small>{entry.path}</small></button></li>)}</ul></section></div> : null}
    </>
  </section></div>;
}
