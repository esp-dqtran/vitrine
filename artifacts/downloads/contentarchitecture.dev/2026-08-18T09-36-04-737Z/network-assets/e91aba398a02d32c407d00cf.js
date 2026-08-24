(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,138313,e=>{"use strict";var t=e.i(843476),n=e.i(500932),r=e.i(905142),i=e.i(307881),s=e.i(88653),o=e.i(271645),a=e.i(258006);function l(e){return e.replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/[_-]+/g," ").trim().split(/\s+/).filter(e=>e.length>0)}function c(e){return 0===e.length?e:`${e[0]?.toUpperCase()??""}${e.slice(1)}`}let d={camelCase:function(e){return l(e).map((e,t)=>0===t?e.toLowerCase():c(e.toLowerCase())).join("")},pascalCase:function(e){return l(e).map(e=>c(e.toLowerCase())).join("")},kebabCase:function(e){return l(e).map(e=>e.toLowerCase()).join("-")},titleCase:function(e){return l(e).map(e=>c(e.toLowerCase())).join(" ")},removeSectionSuffix:function(e){return e.replace(/\s*section$/i,"")}};function u(e,t){return e.replace(/\{\{(.+?)\}\}/g,(e,n)=>(function e(t,n){let r=t.trim(),i=r.match(/^(\w+)\s+\((.+)\)$/);if(i){let t=d[i[1]??""];return t?t(e(i[2]??"",n)):""}let s=r.match(/^(\w+)\s+(\w+)$/);if(s){let e=d[s[1]??""];if(e)return e(n[s[2]??""]??"")}return n[r]??""})(n,t))}function p(e,t){let n=t.trim();if(0===n.length)return null;let r=Number(n);if(Number.isInteger(r)&&r>=1&&r<=e.length)return e[r-1]??null;let i=n.toLowerCase();return e.find(e=>e.id.toLowerCase()===i)??e.find(e=>e.id.toLowerCase().startsWith(i))??e.find(e=>e.id.toLowerCase().includes(i))??null}var m=e.i(778213);let h=`import { createClient } from "next-sanity";
import { defineLive } from "next-sanity/live";
import { draftMode } from "next/headers";
import { env } from "~/env";

// CDN is bypassed in production. The Next.js Data Cache does the work, and a
// Sanity webhook invalidates tags on publish, so content is fresh, never stale.

export const sanityClient = createClient({
  projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: env.NEXT_PUBLIC_SANITY_API_VERSION,
  useCdn: process.env.NODE_ENV === "development",
  stega: { studioUrl: env.NEXT_PUBLIC_SANITY_STUDIO_BASE_PATH },
});

// Write-capable client for API routes (AI generation, uploads); never in render paths.
export const sanityEditClient = createClient({
  ...sanityClient.config(),
  token: env.SANITY_API_EDIT_TOKEN,
  useCdn: false,
});

// Live editing wired in: in Draft Mode the page subscribes to live updates.
const { sanityFetch: liveFetch, SanityLive } = defineLive({ client: sanityClient });
export { SanityLive };

export async function sanityFetch<T>(props: FetchProps): Promise<T> {
  const { query, params = {}, options = {} } = props;

  if ((await draftMode()).isEnabled) {
    const { data } = await liveFetch({ query, params });
    return data as T;
  }

  return sanityClient.fetch<T>(query, params, {
    perspective: "published",
    cache: "force-cache",
    next: { tags: options.next?.tags ?? [] },
  });
}
`,f=`import { revalidateTag } from "next/cache";
import { parseBody } from "next-sanity/webhook";
import { env } from "~/env";

// On publish, Sanity calls this. We bust three tags: the type, the document,
// and its URI. The Data Cache then refetches exactly what changed, nothing more.

export async function POST(req: Request) {
  const { isValidSignature, body } = await parseBody<WebhookPayload>(
    req,
    env.SANITY_REVALIDATE_SECRET,
  );

  if (!isValidSignature || !body?._id) {
    return new Response("Invalid signature", { status: 401 });
  }

  const docId = body._id.replace("drafts.", "");
  const tags = [body._type, \`doc:\${docId}\`, body.uri].filter(Boolean);

  for (const tag of tags) {
    revalidateTag(tag);
  }

  return Response.json({ revalidated: true, tags });
}
`,g=`import type { MetadataRoute } from "next";
import { defineQuery } from "next-sanity";
import { sanityFetch } from "~/features/sanity/client";
import { env } from "~/env";

// Driven by Sanity, never hardcoded, and type-agnostic: every routed document
// that is not noIndex or password protected. Google ignores changefreq and
// priority, so entries carry only the URL and a content-driven lastmod.

const SitemapQ = defineQuery(\`
  *[defined(uri.current) && seoMetadata.noIndex != true && passwordProtected != true]{
    "uri": uri.current,
    "updatedAt": _updatedAt,
  }
\`);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await sanityFetch<SitemapEntry[]>({ query: SitemapQ });

  return pages.map((page) => ({
    url: \`\${env.NEXT_PUBLIC_URL}\${page.uri}\`,
    lastModified: new Date(page.updatedAt),
  }));
}
`,y=`import { NextResponse } from "next/server";
import { env } from "~/env";
import { renderRobotsTxt } from "~/features/agents/ai-crawlers";

// A route handler rather than the robots.ts metadata file: MetadataRoute.Robots can
// only express user-agent groups, and the policy needs a Content-Signal directive and
// comments too. The policy itself lives in features/agents/ai-crawlers.ts.

// No trailing slash on the Studio path: Disallow is a prefix match, so "/studio"
// covers the bare route (which serves 200) and everything under it.

export function GET() {
  const body = renderRobotsTxt({
    disallow: ["/api/", "/_next/", "/studio"],
    sitemap: \`\${env.NEXT_PUBLIC_URL}/sitemap.xml\`,
  });

  return new NextResponse(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
`,x=`import type { Metadata } from "next";
import { sanityFetch } from "~/features/sanity/client";
import { env } from "~/env";

// Per-page metadata, with the Site singleton as the fallback. OpenGraph images
// are auto-cropped to 1200x630 from the image hotspot. Canonical is explicit.

export async function seo(input: SeoInput = {}): Promise<Metadata> {
  // The query reads across both site-wide singletons (the copy from Site, the
  // favicon from Settings), so publishing either one refreshes this metadata.
  const site = await sanityFetch<SiteSeo>({
    query: SiteSeoQ,
    options: { next: { tags: ["site", "siteSettings"] } },
  });

  // The site name backstops the chain: a missing <title> fails a11y and SEO alike.
  const title = input.title ?? site.seoMetadata?.title ?? site.name;
  const description = input.description ?? site.seoMetadata?.description;
  const image = input.image ?? site.seoMetadata?.image;

  return {
    title,
    description,
    robots: input.robots,
    // /favicon.ico first, then the light/dark pair: Google takes one icon per
    // hostname and says nothing about media, so it never gets to pick.
    icons: metadataIconsFromFavicon(site.favicon),
    openGraph: {
      siteName: site.name,
      title,
      description,
      images: image ? [getOgImageSrc(image)] : [],
    },
    alternates: { canonical: input.canonical ?? env.NEXT_PUBLIC_URL },
  };
}
`,b=`import { notFound } from "next/navigation";
import { JsonLd } from "~/components/json-ld";
import { PageSections } from "~/features/page-builder/page-sections";
import { breadcrumbLd, jsonLdGraph, webPageLd } from "~/features/site/seo/structured-data";
import { seo } from "~/features/site/seo/utils";

// One catch-all renders every page. fetchPage resolves the document by URI
// (cached and tagged for revalidation); metadata falls back to the Site
// singleton, then the page builder takes over.

export async function generateMetadata({ params }: PageProps) {
  const { uri } = await params;
  const page = await fetchPage(uri);

  if (!page) {
    // notFound() below owns the 404 status, and not-found.tsx renders the head.
    // This branch only keeps metadata resolution safe on the same request.
    return seo({ title: "Not found", robots: "noindex, follow" });
  }

  return seo({
    title: page.seoMetadata?.title ?? page.title,
    description: page.seoMetadata?.description,
    image: page.seoMetadata?.image,
    canonical: page.uri,
  });
}

export default async function Page({ params }: PageProps) {
  const { uri } = await params;
  const page = await fetchPage(uri);

  if (!page) {
    notFound();
  }

  // One @graph per page: its own WebPage identity plus a breadcrumb trail,
  // both pointing back at the site-level nodes from the layout.
  const graph = jsonLdGraph([
    webPageLd({
      name: page.seoMetadata?.title ?? page.title,
      url: canonical(page.uri),
      description: page.seoMetadata?.description,
      siteUrl: env.NEXT_PUBLIC_URL,
    }),
    ...(page.uri === "/"
      ? []
      : [
          breadcrumbLd([
            { name: "Home", url: canonical("/") },
            { name: page.title, url: canonical(page.uri) },
          ]),
        ]),
  ]);

  return (
    <>
      <JsonLd data={graph} />
      <PageSections docId={page._id} />
    </>
  );
}
`,v=`import dynamic from "next/dynamic";

// Sections register themselves. The page renders whatever the editor arranged,
// matched by _type. Add one with "npm run plop"; this map updates itself.

const sections = {
  textSectionField: dynamic(() =>
    import("./sections/text-section").then((m) => m.TextSection)
  ),
  mediaSectionField: dynamic(() =>
    import("./sections/media-section").then((m) => m.MediaSection)
  ),
  ctaSectionField: dynamic(() =>
    import("./sections/cta-section").then((m) => m.CtaSection)
  ),
  contactFormSectionField: dynamic(() =>
    import("./sections/contact-form-section").then((m) => m.ContactFormSection)
  ),
  // PLOP: Add Import
} as const;

export async function PageSections({ docId }: { docId: string }) {
  // Sections parked with the Disabled toggle are filtered out in GROQ,
  // so they never render, without the editor deleting the content.
  const sectionsArray = await fetchSections(docId);

  // isFirst marks the LCP candidate, so the top section can opt into a
  // priority hint on its image instead of lazy-loading it.
  return sectionsArray.map((section, index) => {
    const Section = sections[section._type];
    return Section ? (
      <Section
        key={section._key}
        docId={docId}
        sectionKey={section._key}
        isFirst={index === 0}
      />
    ) : null;
  });
}
`,S=`import { exec } from "node:child_process";

// Run \`npm run plop\`, pick a generator, name it. Schema, component, types, and
// registration are wired across every file. Then typegen and format run for you.

export default function (plop) {
  plop.setActionType("runCommand", (_, config) => {
    return new Promise((resolve, reject) => {
      exec(config.command, (error) => (error ? reject(error.message) : resolve(config.command)));
    });
  });

  plop.setGenerator("Page Builder Section", {
    description: "Create a new page builder section",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Name (section names will automatically be suffixed with 'Section'. eg. 'cta' -> 'ctaSection')",
        filter: (val) => \`\${val} Section\`,
      },
    ],
    actions: [
      {
        type: "add",
        path: "sanity/schemas/page-sections/{{kebabCase name}}.tsx",
        templateFile: "templates/page-builder-section/schema.tsx.hbs",
      },
      {
        type: "add",
        path: "features/page-builder/sections/{{kebabCase name}}.tsx",
        templateFile: "templates/page-builder-section/component.tsx.hbs",
      },
      {
        type: "modify",
        path: "features/page-builder/page-sections.tsx",
        pattern: "// PLOP: Add Import",
      },
      {
        type: "modify",
        path: "sanity/schemas/page-sections/index.ts",
        pattern: "// PLOP: Add Export",
      },
      { type: "runCommand", abortOnFail: true, description: "Generate types", command: "npm run sanity:typegen" },
      { type: "runCommand", abortOnFail: false, description: "Format code", command: "npm run format" },
    ],
  });

  plop.setGenerator("Prefix Page Route", {
    description: "Create a prefix route /{prefix}/{slug} (e.g. /articles/my-post)",
  });

  plop.setGenerator("Rich Text Block", {
    description: "Create a new rich text block",
  });
}
`,w=`# THE CONTENT ARCHITECTURE / AGENTS

The orchestration layer for agentic tools. Ask an agent to build this from
scratch and you get a different architecture every run, all plausible, none
decided. Here the decisions are made: Claude Code, Cursor, or any agent reads
this first and ingests the conventions instead of inventing them. No drift.

## SKILLS
  sanity                  schema, GROQ, Studio, typegen
  frontend                components, Lenis, Motion
  icons                   one registry, one module that imports SVGs
  scaffolding-plop        generators for routes, sections, blocks
  design-engineering      motion, easing, micro-interactions
  modern-web-guidance     platform patterns: a11y, perf, forms, CSS
  react-performance       RSC, bundle, re-renders, waterfalls
  performance-audit       Lighthouse/CWV audit playbook
  seo-aeo-best-practices  metadata, sitemaps, JSON-LD, EEAT
  agent-markdown          Markdown for agents via content negotiation
  view-transitions        App Router view transition timing
  code-style              TypeScript conventions, run() pattern
  section-colocation      where a section's files live as it grows
  umami-analytics         SSR-safe event instrumentation
  mantine-hooks           listeners, outside-click, disclosure
  dev-server              reuse the running server; local is never gated
  docs-maintenance        keep docs aligned with code
  codebase-design         deep modules, interfaces, seams
  domain-modeling         glossary + decisions as ADRs

## WORKFLOW
  1. Scope first: the smallest set of files to change.
  2. Reuse existing sections and field factories before adding new ones.
  3. Run "npm run sanity:typegen" after any schema change.
  4. Source of truth is the code, not the docs.
`,k=`NEXT_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_SANITY_PROJECT_ID=your-project-id
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=2025-02-19
# Public URL for Studio (default /studio). See docs/sanity/studio-and-structure.md — rewrites to app/sanity-studio/…
NEXT_PUBLIC_SANITY_STUDIO_BASE_PATH=/studio
SANITY_API_VIEW_TOKEN=your-view-token
# Optional: HTTP Basic Auth (see docs/features/basic-auth.md). Same credentials for site-wide and per-URL gates; toggles live in Sanity.
BASIC_AUTH_USERNAME=your-username
BASIC_AUTH_PASSWORD=your-password
SANITY_API_EDIT_TOKEN=your-edit-token
# Optional: shared secret for the Sanity publish webhook (/api/revalidate). Leave unset to skip the webhook.
SANITY_REVALIDATE_SECRET=your-revalidate-secret
# Resend (contact form notifications, email capture audience). Optional in dev; required for those features in production.
RESEND_API_KEY=your-resend-api-key
RESEND_EMAIL_FROM=your-email@example.com
NEXT_PUBLIC_UNAMI_WEBSITE_ID=your-unami-website-id`,_=`node_modules
.next
out
.env
.env*.local
*.log
.DS_Store
.vercel
`,T=`{
  "mcpServers": {
    "next-devtools": {
      "command": "npx",
      "args": ["-y", "next-devtools-mcp@latest"]
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--isolated"]
    }
  }
}
`,A=`save=true
save-exact=true
engine-strict=true
`,N=`24.15.0
`,E=`declare module "*.svg" {
  import type { FC, SVGProps } from "react";
  const ReactComponent: FC<SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}

declare module "*.png";
declare module "*.jpg";
`,j=`{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 130 },
  "linter": { "enabled": true, "rules": { "recommended": true } }
}
`,I=`import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { SANITY_STUDIO_APP_BASE_PATH } from "~/sanity/constants";

// Validated at boot: a missing or malformed var fails the build, not a request.
// The public Studio path is refined so it can never collide with the internal
// route it rewrites to. Import "env" from "~/env" everywhere.

export const env = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnv: {
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_UNAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UNAMI_WEBSITE_ID,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_EMAIL_FROM: process.env.RESEND_EMAIL_FROM,
    SANITY_API_VIEW_TOKEN: process.env.SANITY_API_VIEW_TOKEN,
    SANITY_API_EDIT_TOKEN: process.env.SANITY_API_EDIT_TOKEN,
    SANITY_REVALIDATE_SECRET: process.env.SANITY_REVALIDATE_SECRET,
    NEXT_PUBLIC_SANITY_DATASET: process.env.NEXT_PUBLIC_SANITY_DATASET,
    NEXT_PUBLIC_SANITY_PROJECT_ID: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    NEXT_PUBLIC_SANITY_API_VERSION: process.env.NEXT_PUBLIC_SANITY_API_VERSION,
    NEXT_PUBLIC_SANITY_STUDIO_BASE_PATH: process.env.NEXT_PUBLIC_SANITY_STUDIO_BASE_PATH,
    BASIC_AUTH_USERNAME: process.env.BASIC_AUTH_USERNAME,
    BASIC_AUTH_PASSWORD: process.env.BASIC_AUTH_PASSWORD,
  },
  server: {
    RESEND_API_KEY: z.string().optional(),
    RESEND_EMAIL_FROM: z.string().optional(),
    SANITY_API_VIEW_TOKEN: z.string(),
    SANITY_API_EDIT_TOKEN: z.string(),
    SANITY_REVALIDATE_SECRET: z.string().optional(),
    BASIC_AUTH_USERNAME: z.string().optional(),
    BASIC_AUTH_PASSWORD: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_URL: z.url(),
    NEXT_PUBLIC_UNAMI_WEBSITE_ID: z.string().optional(),
    NEXT_PUBLIC_SANITY_DATASET: z.string(),
    NEXT_PUBLIC_SANITY_PROJECT_ID: z.string(),
    NEXT_PUBLIC_SANITY_API_VERSION: z.string(),
    NEXT_PUBLIC_SANITY_STUDIO_BASE_PATH: z.string().refine(
      (val) => {
        const path = val.trim();
        const withLeading = path.startsWith("/") ? path : \`/\${path}\`;
        return withLeading.replace(/\\/$/, "") !== SANITY_STUDIO_APP_BASE_PATH;
      },
      { message: \`Public Studio path must not match the internal route \${SANITY_STUDIO_APP_BASE_PATH}\` },
    ),
  },
});
`,C=`# Pins the hooks to the .nvmrc Node before anything runs.
rc: .lefthookrc

pre-commit:
  parallel: true
  commands:
    lint-staged:
      run: npx biome check --write --no-errors-on-unmatched {staged_files}
      stage_fixed: true
    typecheck-staged:
      glob: "*.{ts,tsx}"
      run: npx tsc --noEmit -p tsconfig.json
    typecheck-project:
      glob: "package-lock.json"
      run: npx tsc --noEmit -p tsconfig.json
`,R=`# Sourced by lefthook before every hook command. Git GUIs run hooks in a shell
# that never saw \`nvm use\`, so resolve .nvmrc ourselves instead of trusting PATH.

lefthook_node_bin() {
	want=$(tr -d '[:space:]v' < .nvmrc)

	for root in "$NVM_DIR" "$HOME/.nvm"; do
		dir="$root/versions/node/v$want"

		if [ -x "$dir/bin/node" ]; then
			printf '%s\\n' "$dir/bin"
			return 0
		fi
	done

	return 1
}

if node_bin=$(lefthook_node_bin); then
	PATH="$node_bin:$PATH"
	export PATH
fi
`,P=`/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited.
`,L=`import type { NextConfig } from "next";
import { env } from "./env";
import { SANITY_STUDIO_APP_SEGMENT } from "./sanity/constants";

// The public Studio URL is env-driven, while \`app/\${SANITY_STUDIO_APP_SEGMENT}\` is a fixed
// filesystem mount: App Router paths resolve from the folder tree, so no env value can move them.
function publicStudioBase() {
  return env.NEXT_PUBLIC_SANITY_STUDIO_BASE_PATH.replace(/\\/$/, "") || "/studio";
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  experimental: { globalNotFound: true },
  async rewrites() {
    // beforeFiles: this has to win against filesystem routes, not run after them.
    return {
      beforeFiles: [{ source: \`\${publicStudioBase()}/:path*\`, destination: \`/\${SANITY_STUDIO_APP_SEGMENT}/:path*\` }],
    };
  },
  async redirects() {
    return fetchSanityRedirects();
  },
};

export default nextConfig;
`,M=`{
  "name": "the-content-architecture-next-js",
  "version": "0.0.0",
  "private": true,
  "engines": { "node": "^24.15.0", "npm": ">=11.6.2" },
  "volta": { "node": "24.15.0" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "check": "concurrently npm:check.*",
    "check.types": "tsc --noEmit -p tsconfig.json",
    "check.biome": "biome lint --diagnostic-level=error",
    "format": "biome check --write --unsafe",
    "plop": "plop",
    "clear": "rm -rf .next node_modules/.cache",
    "sanity:typegen": "sanity schema extract --force --path='sanity-schema.json' && sanity typegen generate",
    "sanity:schema-deploy": "sanity schema deploy",
    "sanity:project-setup": "dotenvx run -- node --import=tsx scripts/sanity-project-setup/setup.ts"
  },
  "dependencies": {
    "next": "16.3.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "sanity": "6.9.0",
    "next-sanity": "13.3.1",
    "motion": "12.43.0",
    "lenis": "1.3.26",
    "@mux/mux-player-react": "3.13.2",
    "@mantine/hooks": "9.5.1",
    "resend": "6.18.1",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.7",
    "tailwindcss": "4.3.3",
    "typescript": "6.0.3",
    "plop": "4.0.5",
    "concurrently": "10.0.4",
    "lefthook": "2.1.10"
  }
}
`,D=`{
  "name": "the-content-architecture-next-js",
  "version": "0.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "the-content-architecture-next-js",
      "version": "0.0.0"
    }
  }
}
`,U=`import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { IS_DEV } from "~/features/utils/constants";

// One proxy, two jobs on every page request:
//   1. Agent content negotiation: a request that prefers Markdown
//      (Accept: text/markdown) is rewritten to the Markdown route, so agents
//      get a token-light page on the same URL. See docs/features/agent-markdown.md.
//   2. HTTP Basic Auth: gate the whole site or individual URLs with the
//      BASIC_AUTH_* env vars, toggled from the CMS. See docs/features/basic-auth.md.
// Eligibility for both is read from the CMS (cached, busted by the publish webhook).

export async function proxy(request: NextRequest) {
  // Markdown-preferring agents are rewritten to the Markdown route; protected,
  // noindex, or opted-out pages fall through to the Basic Auth gate below.

  // The gate is a deploy-time concern: local development is never asked for a
  // password. IS_DEV is false in every build, so deployments still gate.
  if (IS_DEV) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Pages only: skip /api, /_next, static files, and prefetch requests.
};
`,O=`{
  "_": "Generated by sanity typegen. Do not edit by hand.",
  "documents": ["page", "blog", "article", "articleCategory", "site", "redirect", "contactFormSubmission"],
  "sections": ["mediaSection", "ctaSection", "textSection", "contactFormSection"]
}
`,$=`import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  },
});
`,B=`import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { presentationTool } from "sanity/presentation";
import { media } from "sanity-plugin-media";
import { muxInput } from "sanity-plugin-mux-input";
import { autoAltTextPlugin } from "./sanity/auto-alt-text";
import { buildStructure } from "./sanity/structure";
import { schemaTypes } from "./sanity/schemas";

export default defineConfig({
  name: "default",
  title: "The Content Architecture",
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  plugins: [
    structureTool({ structure: buildStructure }),
    presentationTool({ previewUrl: "/api/draft-mode/enable" }),
    media(),
    muxInput(),
    // Describes every image uploaded to the media browser, so alt text exists
    // before anyone has to remember to write it.
    autoAltTextPlugin(),
  ],
  schema: { types: schemaTypes },
});
`,F=`{
  "compilerOptions": {
    "strict": true,
    "target": "ES2017",
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "paths": { "~/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["*.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`,W=`@AGENTS.md
`,G=`# License

**The Content Architecture, Next.js edition**

Copyright (c) 2026 Edoardo Lunardi. All rights reserved.

Commercial software, not open source. Access is granted on purchase and governed by
this license together with the Terms of Service.

## What you may do

- Use the code in unlimited personal and commercial projects.
- Use it in paid client work.
- Sell, license, and profit from the sites and products you build with it.
- Modify it however you like. Nothing has to be contributed back.
- Ship it without attribution.

## Client work and handover

You may deliver a project built on this code to a client, source included. The client
may run, host, modify, and maintain that project indefinitely. To start a *new* project
from it, they buy their own license.

## What you may not do

- Resell, redistribute, sublicense, or publish this code, in whole or in substantial
  part, as a starter, template, boilerplate, theme, or course.
- Share repository access with anyone who has not bought a license.

The line is simple: build whatever you want with it, do not resell it as it is.
`,z={root:{type:"folder",name:"the-content-architecture-next-js",open:!0,children:[{type:"folder",name:".agents",children:[{type:"folder",name:"skills",children:[(0,m.skill)("sanity","Schema, GROQ, Studio, typegen, content components."),(0,m.skill)("frontend","Runtime UI, components, Lenis, Motion."),(0,m.skill)("icons","The components/icon registry: the only module allowed to import an SVG."),(0,m.skill)("scaffolding-plop","Generator-first routes, page builder sections, rich text blocks."),(0,m.skill)("design-engineering","Motion, easing, micro-interactions, perceived performance."),(0,m.skill)("modern-web-guidance","Framework-agnostic platform patterns: accessibility, performance, forms, CSS."),(0,m.skill)("react-performance","Async waterfalls, RSC, bundle size, re-renders."),(0,m.skill)("performance-audit","Lighthouse/Core Web Vitals audit playbook: measure, fix, verify."),(0,m.skill)("seo-aeo-best-practices","Metadata, Open Graph, sitemaps, JSON-LD, EEAT, AEO."),(0,m.skill)("agent-markdown","Keep the Markdown served to agents (content negotiation) in sync with sections."),(0,m.skill)("view-transitions","App Router view transitions and navigation timing."),(0,m.skill)("code-style","TypeScript conventions and the run() pattern."),(0,m.skill)("section-colocation","Where a page-builder section's files live once it outgrows one file."),(0,m.skill)("umami-analytics","SSR-safe Umami event instrumentation."),(0,m.skill)("mantine-hooks","Listeners, outside-click, disclosure via @mantine/hooks."),(0,m.skill)("dev-server","Reuse the dev server already running; local is never behind Basic Auth."),(0,m.skill)("docs-maintenance","Keep docs and README aligned with code."),(0,m.skill)("codebase-design","Deep modules: interfaces, seams, adapters, testability."),(0,m.skill)("domain-modeling","Glossary in CONTEXT.md, architectural decisions as ADRs.")]}]},{type:"folder",name:".husky",children:[{type:"folder",name:"_",children:[{type:"file",name:"pre-commit",content:"npx lefthook run pre-commit\n"},{type:"file",name:"prepare-commit-msg",content:"npx lefthook run prepare-commit-msg\n"}]}]},{type:"folder",name:"app",children:[{type:"folder",name:"(web)",children:[{type:"folder",name:"[[...uri]]",children:[{type:"file",name:"page.tsx",content:b}]},{type:"folder",name:"blog",children:[{type:"folder",name:"[slug]",children:[(0,m.stub)("page.tsx","Article route: fetch by URI, render the rich text body, emit BlogPosting beside the page's WebPage node.")]},(0,m.stub)("page.tsx","Blog index: the blog singleton fetched by id, rendering the article list and a Blog JSON-LD node.")]},(0,m.stub)("layout.tsx","Web layout: header, footer, Lenis, view transitions, KeyboardFocusMode, and the site-level Organization + WebSite JSON-LD graph.")]},{type:"folder",name:"api",children:[{type:"folder",name:"agent-markdown",children:[{type:"folder",name:"[[...uri]]",children:[(0,m.stub)("route.ts","Serve any routed document as token-light Markdown for agents (the content-negotiation target).")]}]},{type:"folder",name:"agents",children:[{type:"folder",name:"llms-txt",children:[(0,m.stub)("route.ts","POST: draft a spec-compliant llms.txt from your content with Sanity Agent Actions.")]},{type:"folder",name:"page-markdown",children:[(0,m.stub)("route.ts","POST: draft a page's stored agent Markdown with Sanity Agent Actions (the Generate button).")]},{type:"folder",name:"image-alt-text",children:[(0,m.stub)("route.ts","POST: describe one uploaded image, or backfill a batch of the library. Patches the asset, never the document.")]}]},{type:"folder",name:"revalidate",children:[{type:"file",name:"route.ts",content:f}]},{type:"folder",name:"draft-mode",children:[{type:"folder",name:"enable",children:[(0,m.stub)("route.ts","Enter Draft Mode, redirect into the Studio preview.")]},{type:"folder",name:"disable",children:[(0,m.stub)("route.ts","Exit Draft Mode.")]}]},{type:"folder",name:"seo-screenshot",children:[(0,m.stub)("route.ts","Render an OG screenshot for SEO previews.")]}]},{type:"folder",name:"sanity-studio",children:[{type:"folder",name:"[[...index]]",children:[(0,m.stub)("page.tsx","Studio mounted in-app, served at /studio via a rewrite."),(0,m.stub)("studio.tsx","The <NextStudio /> instance with the shared config.")]},(0,m.stub)("layout.tsx","Studio layout: no global chrome, metadata noindex.")]},{type:"folder",name:"favicon.ico",children:[(0,m.stub)("route.ts","The one icon Google indexes. A fixed path that resolves to the CMS favicon, so the URL holds still when the asset changes.")]},{type:"folder",name:"llms.txt",children:[(0,m.stub)("route.ts","Serve the published llms.txt (llmstxt.org): a curated map of the site for AI assistants.")]},{type:"folder",name:"robots.txt",children:[{type:"file",name:"route.ts",content:y}]},(0,m.stub)("shared-web-layout.tsx","Root layout: fonts, providers, <SanityLive />."),{type:"file",name:"sitemap.ts",content:g},(0,m.stub)("not-found.tsx","404 rendered from the Site singleton's error content."),(0,m.stub)("global-not-found.tsx","Standalone 404 for the globalNotFound experimental flag.")]},{type:"folder",name:"components",children:[{type:"file",name:"button.tsx",content:"// cva-based button with variants and an asChild slot.\n"},{type:"file",name:"link.tsx",content:"// Internal/external aware anchor with view-transition support.\n"},{type:"file",name:"image.tsx",content:"// Sanity image with hotspot crop, blur placeholder, sizes.\n"},{type:"file",name:"animated-text.tsx",content:"// Per-character reveal on scroll, reduced-motion aware.\n"},{type:"file",name:"json-ld.tsx",content:"// One JSON-LD <script>: stega-cleans the graph and escapes < so authored copy cannot close the tag.\n"},{type:"file",name:"deferred-mount.tsx",content:"// Defer an expensive client subtree until near-viewport and idle.\n"},{type:"folder",name:"icon",children:[(0,m.stub)("index.tsx","Icon registry mapping names to inline SVGs."),(0,m.stub)("icon-arrow-up.svg","Arrow up icon."),(0,m.stub)("icon-arrow-down.svg","Arrow down icon."),(0,m.stub)("icon-arrow-left.svg","Arrow left icon."),(0,m.stub)("icon-arrow-right.svg","Arrow right icon."),(0,m.stub)("icon-arrow-up-right.svg","Arrow up-right icon.")]},{type:"folder",name:"slot",children:[(0,m.stub)("index.ts","Slot barrel exports."),(0,m.stub)("slot.tsx","asChild composition primitive (merges props onto a child)."),(0,m.stub)("slottable.tsx","Slottable helper.")]},{type:"folder",name:"inner-parallax",children:[(0,m.stub)("index.tsx","Scroll-linked parallax wrapper."),(0,m.stub)("utils.ts","Responsive overflow helpers.")]},{type:"file",name:"portal.tsx",content:"// SSR-safe portal into document.body.\n"},(0,m.stub)("credits.tsx","Credits component.")]},{type:"folder",name:"docs",children:[{type:"file",name:"README.md",content:"# Docs\n\nFeature and Sanity docs hub.\n"},{type:"folder",name:"features",children:[{type:"file",name:"basic-auth.md",content:"# Basic auth\n\nToggle HTTP Basic Auth site-wide or per-page from the CMS.\n"},{type:"file",name:"agent-markdown.md",content:"# Agent Markdown\n\nPublic pages serve a token-light Markdown version to agents that send `Accept: text/markdown`, on the same URL.\n"},{type:"file",name:"llms-txt.md",content:"# llms.txt\n\nAn editable, AI-generated /llms.txt drafted from your content with Sanity Agent Actions.\n"},{type:"file",name:"mcp-servers.md",content:"# MCP servers\n\nProject-scoped `.mcp.json` servers: next-devtools reads the Next.js runtime, chrome-devtools drives a real Chrome for performance traces, screenshots, and screencasts.\n"},{type:"file",name:"view-transitions.md",content:"# View transitions\n\nApp Router transitions and navigation timing.\n"},{type:"file",name:"redirects.md",content:"# Redirects\n\nManaged in Sanity, applied at build time in next.config.ts.\n"}]},{type:"folder",name:"sanity",children:[{type:"file",name:"studio-and-structure.md",content:"# Studio and structure\n\nPublic URL rewrites, reserved paths, singletons.\n"},{type:"file",name:"revalidation-and-caching.md",content:"# Revalidation and caching\n\nCDN bypass, Data Cache, webhook tags.\n"},{type:"file",name:"standalone-folder.md",content:"# Standalone Sanity folder\n\nImports inside sanity/ are relative, so the folder copies into another project and wires up through config.ts.\n"}]}]},{type:"folder",name:"features",children:[{type:"folder",name:"page-builder",children:[{type:"folder",name:"sections",children:[(0,m.stub)("text-section.tsx","Rich text section."),(0,m.stub)("media-section.tsx","Image / video (Mux, file, URL) / Rive / Lottie section."),(0,m.stub)("cta-section.tsx","Call to action with a resolved link."),{type:"folder",name:"contact-form-section",children:[(0,m.stub)("index.tsx","Server wrapper: fetches the section's slice and hands it to the client form."),(0,m.stub)("contact-form.tsx","The client form: validation, honeypot, pending and result states."),(0,m.stub)("actions.ts","Server action: spam checks, store the submission, send the Resend notification.")]}]},{type:"file",name:"page-sections.tsx",content:v},(0,m.stub)("types.ts","SectionProps: docId, sectionKey, isFirst.")]},{type:"folder",name:"blog",children:[(0,m.stub)("article-list.tsx","The listing the blog index renders: the singleton's copy plus every article, newest first."),(0,m.stub)("reading-time.ts","Reading time from the Portable Text blocks the page already fetched, so it cannot drift from the body."),(0,m.stub)("format-date.ts","Fixed-locale date, so the rendered day never depends on the runtime's own.")]},{type:"folder",name:"sanity",children:[{type:"file",name:"client.ts",content:h},{type:"folder",name:"link",children:[(0,m.stub)("index.tsx","<SanityLink>: resolves internal | external | email | phone | file | params."),(0,m.stub)("fragment.ts","GROQ fragment that resolves internal refs to live URIs.")]},{type:"folder",name:"media",children:[(0,m.stub)("index.tsx","<SanityMedia>: image | Mux video | native video | rive | lottie, one switch."),{type:"folder",name:"image",children:[(0,m.stub)("index.tsx","Image media renderer: hotspot crop, LQIP, responsive sizes."),(0,m.stub)("utils.ts","Image URL builder + sizes helpers.")]},(0,m.stub)("mux-video.tsx","<SanityMuxVideo>: Mux player with an LQIP poster."),(0,m.stub)("native-video.tsx","<SanityNativeVideo>: native <video> for a file or URL."),(0,m.stub)("lottie.tsx","<SanityLottie>: Lottie player."),(0,m.stub)("rive.tsx","<SanityRive>: Rive player, mounted only once it is near the viewport."),(0,m.stub)("rive-canvas.tsx","The canvas itself: the state machine has to be named, or the runtime plays once and freezes."),(0,m.stub)("fragment.ts","GROQ fragment returning intrinsic dimensions."),(0,m.stub)("constants.ts","Source widths and poster edge caps, shared by the renderers."),(0,m.stub)("types.ts","CommonMediaProps: dimensions, aspect ratio, and the priority hint."),(0,m.stub)("utils.ts","Aspect ratio parsing and responsive `sizes` helpers.")]},(0,m.stub)("proxy-state.ts","Cached, deduped CMS reads for proxy.ts, which the Next.js data cache cannot serve.")]},{type:"folder",name:"site",children:[{type:"folder",name:"seo",children:[{type:"file",name:"utils.ts",content:x},{type:"file",name:"structured-data.ts",content:m.STRUCTURED_DATA},(0,m.stub)("structured-data.test.ts","Unit tests for the JSON-LD builders."),(0,m.stub)("favicon.ts","Which uploaded icon the stable route serves, and at what size."),(0,m.stub)("fragment.ts","seoMetadata GROQ fragment (noIndex resolves to noindex,follow).")]},{type:"folder",name:"site-error",children:[(0,m.stub)("index.tsx","404 content from the Site singleton."),(0,m.stub)("query.ts","Site error content GROQ query.")]},{type:"folder",name:"site-footer",children:[(0,m.stub)("index.tsx","Footer from the Site singleton."),(0,m.stub)("query.ts","Footer GROQ query.")]},{type:"folder",name:"site-header",children:[(0,m.stub)("index.tsx","Header from the Site singleton."),(0,m.stub)("query.ts","Header GROQ query.")]},(0,m.stub)("query.ts","Site singleton GROQ query (SiteQuery); the favicon projection reads the Settings singleton."),(0,m.stub)("site-nav-link.tsx","Nav link with active state, shared by header and footer."),(0,m.stub)("site-shell.tsx","Site shell: header and footer around the page.")]},{type:"folder",name:"rich-text",children:[(0,m.stub)("index.tsx","Portable Text renderer; blocks register themselves."),{type:"folder",name:"blocks",children:[{type:"folder",name:"media-block",children:[(0,m.stub)("index.tsx","Media block renderer."),(0,m.stub)("fragment.ts","Media block GROQ fragment.")]}]},(0,m.stub)("fragment.ts","Rich text GROQ fragment.")]},{type:"folder",name:"api",children:[(0,m.stub)("auth.ts","API route auth guard (isApiAuthorized).")]},{type:"folder",name:"auth",children:[(0,m.stub)("sanity-basic-auth-proxy.ts","HTTP Basic Auth gate, state sourced from the CMS.")]},{type:"folder",name:"agents",children:[{type:"file",name:"ai-crawlers.ts",content:m.AI_CRAWLERS_TS},(0,m.stub)("markdown.ts","Serialize a page or article to clean Markdown for agents (section-agnostic by convention)."),(0,m.stub)("query.ts","GROQ for the Markdown route and the llms.txt inventory (URI-matched, sitemap-aligned visibility)."),(0,m.stub)("markdown-proxy-state.ts","Cached agent-Markdown eligibility for proxy.ts, busted by the publish webhook."),(0,m.stub)("alt-text.ts","The alt text instruction and its normalizer, plus the image-description agent call. Pure enough to unit test.")]},{type:"folder",name:"spam-prevention",children:[(0,m.stub)("form-honeypot.tsx","Hidden honeypot field."),(0,m.stub)("use-spam-prevention.ts","Timing + honeypot client guard."),(0,m.stub)("constants.ts","Honeypot field name and the timing thresholds."),(0,m.stub)("utils.ts","detectSpam: honeypot + elapsed-time checks, shared by the form and the action.")]},{type:"folder",name:"view-transition",children:[(0,m.stub)("app-view-transitions.tsx","ViewTransitions wrapper, Link, and transition router for App Router navigations."),(0,m.stub)("context.tsx","Whether a transition is running, so intro animations can wait for it.")]},{type:"folder",name:"draft-mode",children:[(0,m.stub)("index.tsx","Draft Mode provider + toolbar."),(0,m.stub)("context.tsx","DraftModeProvider context."),(0,m.stub)("actions.ts","Enable / disable server actions.")]},{type:"folder",name:"mux",children:[(0,m.stub)("player.tsx","Mux player wrapper."),(0,m.stub)("utils.ts","Poster dimensions for the preview and the player, aspect preserved.")]},{type:"folder",name:"umami",children:[(0,m.stub)("tracking.ts","SSR-safe Umami event helpers."),(0,m.stub)("types.ts","Event and payload types.")]},{type:"folder",name:"motion",children:[(0,m.stub)("lazy-motion.tsx","App-wide LazyMotion provider: the animation renderer loads async, components use m.*."),(0,m.stub)("motion-features.ts","Async feature bundle (domAnimation) for LazyMotion."),(0,m.stub)("split-lines.ts","Split copy into lines for the reveal, and resplit it when the text reflows."),(0,m.stub)("viewport.ts","Shared Motion viewport config."),(0,m.stub)("use-viewport-entered.ts","Hook: fires when an element enters the viewport."),(0,m.stub)("use-prefers-reduced-motion.ts","Reduced-motion hook (useSyncExternalStore).")]},{type:"folder",name:"dom",children:[(0,m.stub)("use-breakpoint.ts","Tailwind-aligned breakpoints + touch detection."),(0,m.stub)("use-near-viewport.ts","Latches true once an element is close enough to load its heavy media in time."),(0,m.stub)("use-ios-viewport-zoom-guard.ts","Stops iOS zooming into a focused input under 16px, without giving up the type scale."),(0,m.stub)("keyboard-focus-mode.tsx","Focus-ring only for keyboard users."),(0,m.stub)("constants.ts","The Tailwind screen sizes, in one place both CSS and JS read."),(0,m.stub)("utils.ts","parseResponsiveValues: read a Tailwind-style responsive string into breakpoint values.")]},{type:"folder",name:"style",children:[(0,m.stub)("utils.ts","cva, cx, compose configured with tailwind-merge.")]},{type:"folder",name:"utils",children:[(0,m.stub)("common.ts","run() helper and shared utilities."),(0,m.stub)("constants.ts","IS_CLIENT / IS_SERVER runtime guards."),(0,m.stub)("easings.ts","Shared easing curves."),(0,m.stub)("pathname.ts","normalizePathname: one canonical pathname form for proxy.ts and its state readers.")]},{type:"folder",name:"fonts",children:[(0,m.stub)("index.ts","next/font setup (Geist).")]},{type:"file",name:"lenis.tsx",content:"// Global Lenis smooth-scroll provider.\n"},(0,m.stub)("use-content-ready.ts","Hold an intro animation until the route transition has finished revealing the page.")]},{type:"folder",name:"sanity",children:[{type:"folder",name:"schemas",children:[{type:"folder",name:"documents",children:[{type:"file",name:"page.tsx",content:m.PAGE_SCHEMA},(0,m.stub)("blog.tsx","Blog index singleton: same Page / Content / SEO / Agents tabs as a page, no page builder, URI pinned to /blog."),(0,m.stub)("article.tsx","Article document: slugs under /blog, one rich text body instead of a page builder."),(0,m.stub)("article-category.tsx","Article taxonomy term."),(0,m.stub)("site.tsx","Global singleton: the copy that renders on every page (header, footer, SEO defaults, the 404)."),(0,m.stub)("site-settings.tsx","Settings singleton: redirects, Basic Auth, the favicon, the Agents tab (llms.txt, automatic alt text), notification emails."),(0,m.stub)("redirect.tsx","From -> to with a 301/302 status, applied at build time in next.config.ts."),(0,m.stub)("contact-form-submission.tsx","API-only, read-only form submissions."),(0,m.stub)("image-alt-text.tsx","Scratch type the alt text agent generates into. Hidden from editors: alt text lands on the image asset.")]},{type:"folder",name:"fields",children:[{type:"file",name:"create-link.tsx",content:m.CREATE_LINK},{type:"file",name:"create-media.tsx",content:m.CREATE_MEDIA},{type:"file",name:"create-page-builder.tsx",content:m.CREATE_PAGE_BUILDER},{type:"file",name:"create-uri-field.tsx",content:m.CREATE_URI_FIELD},{type:"folder",name:"create-rich-text",children:[{type:"file",name:"index.tsx",content:m.CREATE_RICH_TEXT},{type:"folder",name:"blocks",children:[(0,m.stub)("index.ts","Block registry."),(0,m.stub)("media-block.tsx","Media block renderer.")]}]},(0,m.stub)("create-agent-markdown-field.tsx","Agents tab field factory: the stored Markdown mirror plus its Generate flow."),(0,m.stub)("create-icon.tsx","Icon picker field."),(0,m.stub)("create-seo-field.tsx","SEO field factory: noIndex, title, description, share image, and the agent-Markdown toggle."),(0,m.stub)("app-color.tsx","Color field."),(0,m.stub)("aspect-ratio.tsx","Aspect ratio field."),(0,m.stub)("video-options.tsx","Video playback options field."),(0,m.stub)("lottie-options.tsx","Lottie playback options field."),(0,m.stub)("rive-options.tsx","Rive playback options field.")]},{type:"folder",name:"page-sections",children:[(0,m.stub)("text-section.tsx","Schema for the text section."),(0,m.stub)("media-section.tsx","Schema for the media section."),(0,m.stub)("cta-section.tsx","Schema for the CTA section."),(0,m.stub)("contact-form-section.tsx","Schema for the contact form section."),{type:"file",name:"index.ts",content:m.PAGE_SECTIONS_SCHEMA_INDEX}]},{type:"file",name:"index.ts",content:"export const schemaTypes = [\n  page,\n  blog,\n  article,\n  articleCategory,\n  site,\n  redirect,\n  contactFormSubmission,\n  // shared objects + ...sections\n];\n"}]},(0,m.stub)("config.ts","Runtime config seam: site URL, API version, Studio base path, host endpoints."),{type:"file",name:"structure.tsx",content:m.STRUCTURE_TSX},{type:"file",name:"constants.ts",content:m.CONSTANTS_TS},(0,m.stub)("utils.ts","Shared factory helpers: visibleIf / requiredIf, selectByName (whitelist/blacklist), composeValidation."),(0,m.stub)("actions.tsx","Custom Studio document actions."),(0,m.stub)("templates.tsx","Initial-value templates for new documents."),(0,m.stub)("auto-alt-text.tsx","Studio plugin: listens for image uploads and has each one described, so alt text is written before anyone forgets."),{type:"folder",name:"inputs",children:[(0,m.stub)("asset-dimensions-input.tsx","Lottie and Rive file inputs that read back asset dimensions."),(0,m.stub)("async-autocomplete.tsx","Async autocomplete input."),(0,m.stub)("clearable-object-input.tsx","Object input with a clear button."),(0,m.stub)("generate-text-input.tsx","Agent Markdown and llms.txt field inputs: textarea plus a Generate-with-Sanity-AI button."),(0,m.stub)("redeploy-input.tsx","Redeploy site button: triggers the deploy hook from the Studio."),(0,m.stub)("alt-text-input.tsx","Automatic alt text panel: the on/off toggle plus a batched backfill for images already in the library."),(0,m.stub)("seo-image-input.tsx","SEO image input with preview.")]},{type:"folder",name:"lib",children:[(0,m.stub)("parse-lottie-dimensions.ts","Read intrinsic dimensions from a Lottie file."),(0,m.stub)("parse-rive-dimensions.ts","Read intrinsic dimensions from a Rive file.")]}]},{type:"folder",name:"scripts",children:[{type:"folder",name:"sanity-dataset",children:[(0,m.stub)("export.ts","Export the dataset to disk."),(0,m.stub)("import.ts","Import a dataset backup or the bundled seed content."),(0,m.stub)("migrate.ts","Copy one dataset into another. production -> staging.")]},{type:"folder",name:"sanity-project-setup",children:[(0,m.stub)("setup.ts","One command bootstrap: project, tokens, CORS, webhook, .env.")]}]},{type:"folder",name:"seed",children:[{type:"file",name:"README.md",content:"# Seed content\n\nExample pages, articles, and media. Import with `npm run sanity:dataset-import`.\n"},(0,m.stub)("seed-dataset.tar.gz","Bundled starter dataset (pages, articles, media).")]},{type:"folder",name:"templates",children:[{type:"folder",name:"page-builder-section",children:[(0,m.stub)("schema.tsx.hbs","defineField object for {{name}}."),(0,m.stub)("component.tsx.hbs","Server Component for {{name}} with its sanityFetch query.")]},{type:"folder",name:"page-route",children:[(0,m.stub)("schema.tsx.hbs","Document schema for {{documentType}}."),(0,m.stub)("page.tsx.hbs","Route for {{routePrefix}}."),(0,m.stub)("structure.tsx.hbs","Studio list item.")]},{type:"folder",name:"rich-text-block",children:[(0,m.stub)("schema.tsx.hbs","Block schema for {{name}}."),(0,m.stub)("component.tsx.hbs","Block renderer."),(0,m.stub)("fragment.ts.hbs","Block GROQ fragment.")]}]},{type:"file",name:".env.example",content:k},{type:"file",name:".gitignore",content:_},{type:"file",name:".lefthookrc",content:R},{type:"file",name:".mcp.json",content:T},{type:"file",name:".npmrc",content:A},{type:"file",name:".nvmrc",content:N},{type:"file",name:"AGENTS.md",content:w},{type:"file",name:"assets.d.ts",content:E},{type:"file",name:"biome.jsonc",content:j},{type:"file",name:"CLAUDE.md",content:W},{type:"file",name:"env.ts",content:I},{type:"file",name:"GETTING-STARTED.md",content:"# Getting started\n\nThe guided path from a fresh clone to your first rendered section. The README and docs/ are the reference; this file is the walkthrough.\n"},{type:"file",name:"lefthook.yml",content:C},{type:"file",name:"LICENSE.md",content:G},{type:"file",name:"next-env.d.ts",content:P},{type:"file",name:"next.config.ts",content:L},{type:"file",name:"package.json",content:M},{type:"file",name:"package-lock.json",content:D},{type:"file",name:"plopfile.mjs",content:S},{type:"file",name:"proxy.ts",content:U},{type:"file",name:"README.md",content:'# The Content Architecture (Next.js)\n\nA modern Next.js 16.3 starter with Sanity CMS integration.\n\n## Features\n\n- Next.js 16.3 with App Router and Server Components\n- Sanity CMS with in-app Studio\n- TypeScript 6, Tailwind CSS 4, and Biome\n- Reusable components, page builder sections, and rich text blocks\n- Draft mode with Sanity Live, SEO helpers, and ISR revalidation\n- **HTTP Basic Auth (optional):** `proxy.ts` gates the site or individual URLs using\n  `BASIC_AUTH_*` environment variables and CMS toggles (Site -> Security, per-entry\n  "Password protect"). See [`docs/features/basic-auth.md`](docs/features/basic-auth.md).\n- **llms.txt for AI assistants:** an editable, AI-generated `/llms.txt` (per llmstxt.org),\n  drafted from your content with Sanity Agent Actions from the Site document\'s Agents tab.\n  See [`docs/features/llms-txt.md`](docs/features/llms-txt.md).\n- **Agent Markdown (content negotiation):** pages and articles serve a token-light Markdown version\n  to agents that send `Accept: text/markdown`, on the same URL. Generated and stored per page from\n  the Agents tab, then served verbatim. See [`docs/features/agent-markdown.md`](docs/features/agent-markdown.md).\n- Feature modules for redirects, Umami analytics, view transitions, Mux and\n  native video, and spam prevention\n- Scaffolding via Plop for repeatable section/block generation\n- Seed dataset of example content (pages, articles, media), imported with `npm run sanity:dataset-import`\n- [`@mantine/hooks`](https://mantine.dev/hooks/getting-started/) for shared React hooks;\n  `features/dom/use-breakpoint.ts` wraps `useMediaQuery` for Tailwind-aligned\n  breakpoints and touch detection\n\n## Getting Started\n\n**New here? Start with [`GETTING-STARTED.md`](GETTING-STARTED.md).** It is the guided, top to bottom path\nfrom a fresh clone to your first rendered section. The sections below are the reference.\n\n### Prerequisites\n\n- Node.js 24.15.0, pinned in `.nvmrc` and in `package.json` (`engines`, `volta`).\n  `engines` requires the `^24.15.0` LTS line, so npm refuses to install on any other major.\n- npm >= 11.6.2\n\n### Installation\n\n```bash\nnpm install\n```\n\n### Environment Variables\n\nCreate a `.env` file and add at least:\n\n```env\nSANITY_API_VIEW_TOKEN=your-view-token\nSANITY_API_EDIT_TOKEN=your-edit-token\n# Optional: only needed if you register the Sanity publish webhook\nSANITY_REVALIDATE_SECRET=your-revalidate-secret\nRESEND_API_KEY=your-resend-api-key\nRESEND_EMAIL_FROM=notifications@your-domain.com\nNEXT_PUBLIC_URL=http://localhost:3000\nNEXT_PUBLIC_SANITY_DATASET=production\nNEXT_PUBLIC_SANITY_PROJECT_ID=your-project-id\nNEXT_PUBLIC_SANITY_API_VERSION=2025-02-19\nNEXT_PUBLIC_SANITY_STUDIO_BASE_PATH=/studio\n```\n\n`NEXT_PUBLIC_SANITY_STUDIO_BASE_PATH` is the public URL for Studio. The app mounts\nStudio under `app/sanity-studio/`; `next.config.ts` rewrites the public path to that\nfolder. See [`docs/sanity/studio-and-structure.md`](docs/sanity/studio-and-structure.md).\n\n### HTTP Basic Auth (optional)\n\nFor staging or client-review gates, set `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD`\nin the same environment as the app. Turn protection on in Sanity (site-wide and/or\nper document with "Password protect"); credentials are not stored in the CMS. Full\nbehavior: [`docs/features/basic-auth.md`](docs/features/basic-auth.md).\n\n### Development\n\n```bash\nnpm run dev\n```\n\n- App: [http://localhost:3000](http://localhost:3000)\n- Studio: `http://localhost:3000` + your `NEXT_PUBLIC_SANITY_STUDIO_BASE_PATH`\n\n### Build\n\n```bash\nnpm run build\nnpm run start\n```\n\n## Docs\n\nFeature-level docs live in `docs/` so the root README stays lightweight.\n\n- Documentation hub: [`docs/README.md`](docs/README.md)\n- HTTP Basic Auth (env + CMS toggles, `proxy.ts`): [`docs/features/basic-auth.md`](docs/features/basic-auth.md)\n- Redirects: [`docs/features/redirects.md`](docs/features/redirects.md)\n- Code generation (Plop): [`docs/features/code-generation.md`](docs/features/code-generation.md)\n- Spam prevention: [`docs/features/spam-prevention.md`](docs/features/spam-prevention.md)\n- Umami tracking: [`docs/features/umami-tracking.md`](docs/features/umami-tracking.md)\n- View transitions: [`docs/features/view-transitions.md`](docs/features/view-transitions.md)\n- Git hooks: [`docs/features/git-hooks.md`](docs/features/git-hooks.md)\n- Agent skills: [`docs/features/agent-skills.md`](docs/features/agent-skills.md)\n- Dataset export and migration: [`docs/sanity/dataset-migration.md`](docs/sanity/dataset-migration.md)\n- Sanity project setup: [`docs/sanity/project-setup.md`](docs/sanity/project-setup.md)\n\n## Scripts\n\n- `npm run dev`: Start development server\n- `npm run build`: Build for production\n- `npm run start`: Start production server\n- `npm run check`: Every check in parallel (`check.types` + `check.biome`)\n- `npm run check.types`: TypeScript type checking\n- `npm run check.biome`: Biome lint\n- `npm run format`: Format with Biome\n- `npm run sanity:typegen`: Generate Sanity types\n- `npm run plop`: Scaffold new sections and rich text blocks\n- `npm run sanity:cli`: Run the Sanity CLI with `.env` loaded (via dotenvx)\n- `npm run sanity:dataset-export`: Backup a dataset to `./backups/`\n- `npm run sanity:dataset-import`: Import a dataset backup or the bundled seed content\n- `npm run sanity:dataset-migrate`: Copy one dataset into another with confirmations\n- `npm run sanity:project-setup`: Wizard for project, tokens, CORS, webhook, and `.env`\n\n## Project Structure\n\n```text\n.\n|-- app/             # Next.js App Router\n|-- components/      # Shared React components\n|-- features/        # Feature modules\n|-- public/          # Static assets\n|-- sanity/          # Sanity config, schema, structure\n|-- scripts/         # Dataset and project-setup CLIs\n|-- seed/            # Bundled starter content (dataset export)\n|-- docs/            # Project documentation\n|-- proxy.ts         # Next.js Proxy (Basic Auth: env + CMS toggles)\n|-- next.config.ts   # Next.js config and rewrites\n+-- env.ts           # Typed environment config\n```\n\n## Agent Skills\n\nAI guidance for this repository lives in `AGENTS.md` and `.agents/skills/`.\n\n## License\n\nCommercial, one license per buyer. Build unlimited personal, commercial, and client projects with it, and sell what you build. Do not resell or republish the boilerplate itself.\n\nSee LICENSE.md for the full terms, and the Terms of Service for the purchase terms.\n',active:!0},{type:"file",name:"sanity-schema.json",content:O},{type:"file",name:"sanity.cli.ts",content:$},{type:"file",name:"sanity.config.ts",content:B},{type:"file",name:"skills-lock.json",content:'{\n  "_": "Pinned versions for the installed agent skill packs (modern-web-guidance)."\n}\n'},{type:"file",name:"tsconfig.json",content:F}]},footer:[],terminal:{prompt:">",initialCommand:"cd the-content-architecture-next-js"},generators:[{id:"Page Builder Section",description:"Create a new page builder section",prompts:[{name:"name",message:"Name (section names will automatically be suffixed with 'Section'. eg. 'cta' -> 'ctaSection')",filter:e=>`${e} Section`}],actions:[{type:"add",path:"./sanity/schemas/page-sections/{{kebabCase name}}.tsx",template:"// Schema for the {{titleCase (removeSectionSuffix name)}} section.\n"},{type:"modify",path:"./sanity/schemas/page-sections/index.ts",pattern:/(\/\/ PLOP: Add Import)/g,template:'import { {{camelCase name}} } from "./{{kebabCase name}}";\n$1'},{type:"modify",path:"./sanity/schemas/page-sections/index.ts",pattern:/(\/\/ PLOP: Add Export)/g,template:"{{camelCase name}},\n  $1"},{type:"add",path:"features/page-builder/sections/{{kebabCase name}}.tsx",template:"// {{titleCase (removeSectionSuffix name)}} section.\n"},{type:"modify",path:"features/page-builder/page-sections.tsx",pattern:/(\/\/ PLOP: Add Import)/g,template:'{{camelCase name}}Field: dynamic(() => import("~/features/page-builder/sections/{{kebabCase name}}").then((mod) => mod.{{pascalCase name}})),\n  $1'},{type:"run",description:"Generate types"},{type:"run",description:"Format code"}]}]},H=[{id:"next",label:"Next.js"},{id:"astro",label:"Astro"}],Y="next";function V(e){return H.find(t=>t.id===e)?.comingSoon===!0}async function X(t){return"astro"===t?(await e.A(509744)).astroIdeData:z}let K=[{type:"comment",re:/\/\/[^\n]*/},{type:"comment",re:/\/\*[\s\S]*?\*\//},{type:"string",re:/`(?:\\[\s\S]|[^`\\])*`/},{type:"property",re:/"(?:\\.|[^"\\\n])*"(?=\s*:)/},{type:"string",re:/"(?:\\.|[^"\\\n])*"/},{type:"string",re:/'(?:\\.|[^'\\\n])*'/},{type:"number",re:/\b0x[0-9a-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b/},{type:"keyword",re:/\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|implements|interface|type|enum|import|export|from|default|async|await|yield|try|catch|finally|throw|typeof|instanceof|void|delete|this|super|null|undefined|true|false|as|satisfies|readonly|public|private|protected|static|namespace|declare|abstract|keyof|infer|in|of)\b/},{type:"type",re:/\b[A-Z][A-Za-z0-9_$]*\b/},{type:"func",re:/\b[a-zA-Z_$][\w$]*(?=\s*\()/},{type:"punctuation",re:/[{}()[\].,;:?=+\-*/%<>!&|^~@]/}],q=[{type:"comment",re:/<!--[\s\S]*?-->/},{type:"fence",re:/```[\s\S]*?```/},{type:"heading",re:/(?<=^|\n)#{1,6} [^\n]*/},{type:"string",re:/`[^`\n]+`/},{type:"type",re:/\*\*[^*\n]+\*\*|__[^_\n]+__/},{type:"func",re:/!?\[[^\]\n]*\]\([^)\n]+\)/},{type:"number",re:/(?<=^|\n) {0,3}\d+\.(?= )/},{type:"punctuation",re:/(?<=^|\n) {0,3}[-*+](?= )|(?<=^|\n) {0,3}>(?= )/}],Q=[{type:"comment",re:/#[^\n]*/},{type:"property",re:/(?<=^|\n)[ \t]*[\w.$-]+(?=[ \t]*[:=])/},{type:"string",re:/"(?:\\.|[^"\\\n])*"|'[^'\n]*'/},{type:"number",re:/\b\d[\d_.]*\b/},{type:"punctuation",re:/[:=]/}],J=new Set(["ts","tsx","js","jsx","mjs","cjs","json","jsonc","hbs"]),Z=new Set(["md","mdx"]),ee=new Set(["yml","yaml","env","npmrc","nvmrc","gitignore"]),et=new Set(["README","CHANGELOG"]),en={comment:"text-white/30 italic",fence:"text-white/40",string:"text-[#d6a878]",number:"text-[#d6a878]",keyword:"text-[#9fb6d6]",type:"text-white/90",func:"text-white/75",property:"text-white/60",heading:"text-[#9fb6d6]",punctuation:"text-white/35"};function er(e){let r,i,s,a,l,c,d,u,p,m,h,f,g,y,x,b,v,S,w,k,_,T,A,N,E,j,I,C,R,P=(0,n.c)(67),{path:L,name:M,initialValue:D,onChange:U}=e,[O,$]=o.useState(D),[B,F]=o.useState(0),W=o.useRef(null),G=o.useRef(null),z=o.useRef(null),H=o.useRef(null),Y=o.useRef(null),V=o.useRef(null),X=o.useRef(!1);P[0]!==M||P[1]!==O?(r=function(e,t){let n=function(e){switch(e){case"code":return K;case"markdown":return q;case"config":return Q;default:return null}}(t);if(!n||0===e.length)return[{type:"plain",value:e}];let r=n.map(e=>({type:e.type,re:new RegExp(e.re.source,e.re.flags.includes("i")?"iy":"y")})),i=[],s=0,o=0;for(;o<e.length;){let t=!1;for(let n of r){n.re.lastIndex=o;let r=n.re.exec(e);if(r&&r[0].length>0){s<o&&i.push({type:"plain",value:e.slice(s,o)}),i.push({type:n.type,value:r[0]}),o+=r[0].length,s=o,t=!0;break}}t||(o+=1)}return s<e.length&&i.push({type:"plain",value:e.slice(s)}),i}(O,function(e){if(et.has(e))return"markdown";let t=e.includes(".")?e.split(".").pop()??"":"";return Z.has(t)?"markdown":J.has(t)?"code":ee.has(t)||e.startsWith(".")?"config":"plain"}(M??"")),P[0]=M,P[1]=O,P[2]=r):r=P[2];let en=r;P[3]!==O?(i=O.split("\n"),P[3]=O,P[4]=i):i=P[4];let er=i,ea=er.length;P[5]!==ea?(s=Array.from({length:ea},eo),P[5]=ea,P[6]=s):s=P[6];let el=s.join("\n"),ec=Math.min(4,Math.max(1,(B-16)/Math.max(ea,1))),ed=ec*ea;P[7]===Symbol.for("react.memo_cache_sentinel")?(a=()=>{let e=W.current;if(!e)return;let t=new ResizeObserver(()=>F(e.clientHeight));return t.observe(e),F(e.clientHeight),()=>t.disconnect()},l=[],P[7]=a,P[8]=l):(a=P[7],l=P[8]),o.useLayoutEffect(a,l),P[9]!==ed?(c=()=>{let e=G.current;if(!e)return;H.current&&(H.current.scrollTop=e.scrollTop),z.current&&(z.current.scrollTop=e.scrollTop,z.current.scrollLeft=e.scrollLeft);let t=V.current;if(t&&e.scrollHeight>0){let n=e.scrollTop/e.scrollHeight*ed,r=e.clientHeight/e.scrollHeight*ed;t.style.transform=`translateY(${n}px)`,t.style.height=`${r}px`}},P[9]=ed,P[10]=c):c=P[10];let eu=c;P[11]!==eu?(d=()=>{eu()},P[11]=eu,P[12]=d):d=P[12],P[13]!==eu||P[14]!==O?(u=[eu,O],P[13]=eu,P[14]=O,P[15]=u):u=P[15],o.useEffect(d,u),P[16]!==ed?(p=e=>{let t=Y.current,n=G.current;if(!t||!n||ed<=0)return;let r=(e-t.getBoundingClientRect().top)/ed*n.scrollHeight-n.clientHeight/2;n.scrollTop=Math.max(0,Math.min(r,n.scrollHeight-n.clientHeight))},P[16]=ed,P[17]=p):p=P[17];let ep=p;P[18]!==er?(m=er.map(es),P[18]=er,P[19]=m):m=P[19];let em=m;if(!L){let e;return P[20]===Symbol.for("react.memo_cache_sentinel")?(e=(0,t.jsx)("div",{className:"flex min-h-0 flex-1 items-center justify-center font-mono text-caption-10 text-white/30",children:"// select a file to open it"}),P[20]=e):e=P[20],e}P[21]!==M?(h=(0,t.jsx)("div",{className:"shrink-0 border-white/10 border-b px-16 py-10 font-mono text-caption-10 text-white/40 uppercase tracking-wide",children:M}),P[21]=M,P[22]=h):h=P[22],P[23]===Symbol.for("react.memo_cache_sentinel")?(f={paddingTop:16,paddingBottom:16},P[23]=f):f=P[23],P[24]!==el?(g=(0,t.jsx)("div",{ref:H,className:"shrink-0 select-none overflow-hidden border-white/10 border-r",children:(0,t.jsx)("pre",{"aria-hidden":!0,className:"whitespace-pre pr-8 pl-12 text-right font-mono text-caption-10 text-white/25 leading-relaxed",style:f,children:el})}),P[24]=el,P[25]=g):g=P[25],P[26]===Symbol.for("react.memo_cache_sentinel")?(y={paddingTop:16,paddingBottom:16},P[26]=y):y=P[26],P[27]!==en?(x=en.map(ei),P[27]=en,P[28]=x):x=P[28],P[29]!==x?(b=(0,t.jsx)("pre",{ref:z,"aria-hidden":!0,className:"pointer-events-none absolute inset-0 z-0 overflow-hidden whitespace-pre pr-16 pl-12 font-mono text-caption-10 text-ghost-grey leading-relaxed",style:y,children:x}),P[29]=x,P[30]=b):b=P[30];let eh=`${M} contents`;if(P[31]!==U||P[32]!==L?(v=e=>{let t=e.target.value;$(t),U(L,t)},P[31]=U,P[32]=L,P[33]=v):v=P[33],P[34]===Symbol.for("react.memo_cache_sentinel")?(S={paddingTop:16,paddingBottom:16},P[34]=S):S=P[34],P[35]!==eu||P[36]!==eh||P[37]!==v||P[38]!==O?(w=(0,t.jsx)("textarea",{ref:G,"aria-label":eh,spellCheck:!1,autoCapitalize:"off",autoCorrect:"off",wrap:"off",value:O,onChange:v,onScroll:eu,className:"scrollbar-thin relative z-2 min-h-0 min-w-0 flex-1 resize-none whitespace-pre bg-transparent pr-16 pl-12 font-mono text-caption-10 text-transparent leading-relaxed caret-white/80 outline-none",style:S}),P[35]=eu,P[36]=eh,P[37]=v,P[38]=O,P[39]=w):w=P[39],P[40]!==b||P[41]!==w?(k=(0,t.jsxs)("div",{className:"relative flex min-h-0 min-w-0 flex-1",children:[b,w]}),P[40]=b,P[41]=w,P[42]=k):k=P[42],P[43]!==ep?(_=e=>{X.current=!0,e.currentTarget.setPointerCapture(e.pointerId),ep(e.clientY)},T=e=>{X.current&&ep(e.clientY)},P[43]=ep,P[44]=_,P[45]=T):(_=P[44],T=P[45]),P[46]===Symbol.for("react.memo_cache_sentinel")?(A=e=>{X.current=!1,e.currentTarget.releasePointerCapture(e.pointerId)},P[46]=A):A=P[46],P[47]!==ed?(N={height:ed},P[47]=ed,P[48]=N):N=P[48],P[49]!==em||P[50]!==ec){let e;P[52]!==ec?(e=(e,n)=>(0,t.jsx)("div",{className:"flex items-center",style:{height:ec},children:(0,t.jsx)("div",{className:"rounded-full bg-white/20",style:{marginLeft:.5*e.indent,width:0===e.length?0:Math.min(.5*e.length,52),height:Math.max(1,ec-1)}})},n),P[52]=ec,P[53]=e):e=P[53],E=em.map(e),P[49]=em,P[50]=ec,P[51]=E}else E=P[51];return P[54]===Symbol.for("react.memo_cache_sentinel")?(j=(0,t.jsx)("div",{ref:V,"aria-hidden":!0,className:"pointer-events-none absolute inset-x-0 top-0 bg-white/10 ring-1 ring-white/15 ring-inset"}),P[54]=j):j=P[54],P[55]!==_||P[56]!==T||P[57]!==N||P[58]!==E?(I=(0,t.jsx)("div",{className:"relative hidden w-64 shrink-0 overflow-hidden border-white/10 border-l sm:block",children:(0,t.jsxs)("button",{ref:Y,type:"button","aria-label":"Scroll via minimap",onPointerDown:_,onPointerMove:T,onPointerUp:A,style:N,className:"relative block w-full cursor-pointer touch-none px-6 text-left outline-none",children:[E,j]})}),P[55]=_,P[56]=T,P[57]=N,P[58]=E,P[59]=I):I=P[59],P[60]!==g||P[61]!==k||P[62]!==I?(C=(0,t.jsxs)("div",{ref:W,className:"flex min-h-0 flex-1 bg-black-deep/30",children:[g,k,I]}),P[60]=g,P[61]=k,P[62]=I,P[63]=C):C=P[63],P[64]!==h||P[65]!==C?(R=(0,t.jsxs)("div",{className:"flex min-h-0 flex-1 flex-col",children:[h,C]}),P[64]=h,P[65]=C,P[66]=R):R=P[66],R}function ei(e,n){return(0,t.jsx)("span",{className:"plain"===e.type?void 0:en[e.type],children:e.value},n)}function es(e){let t=e.trimStart();return{indent:e.length-t.length,length:t.length}}function eo(e,t){return t+1}var ea=e.i(801335);function el(e){let r,i,s=(0,n.c)(5),{className:o,children:a}=e;return s[0]!==o?(r=(0,ea.cx)("size-[1.05em] shrink-0",o),s[0]=o,s[1]=r):r=s[1],s[2]!==a||s[3]!==r?(i=(0,t.jsx)("svg",{viewBox:"0 0 16 16","aria-hidden":"true",fill:"none",stroke:"currentColor",strokeWidth:1.2,strokeLinecap:"round",strokeLinejoin:"round",className:r,children:a}),s[2]=a,s[3]=r,s[4]=i):i=s[4],i}function ec(e){let r,i,s,o=(0,n.c)(6),{open:a,className:l}=e,c=a&&"rotate-90";return o[0]!==l||o[1]!==c?(r=(0,ea.cx)("size-[0.85em] shrink-0 opacity-50 transition-transform duration-200 ease-out motion-reduce:transition-none",c,l),o[0]=l,o[1]=c,o[2]=r):r=o[2],o[3]===Symbol.for("react.memo_cache_sentinel")?(i=(0,t.jsx)("path",{d:"M6 4l4 4-4 4"}),o[3]=i):i=o[3],o[4]!==r?(s=(0,t.jsx)("svg",{viewBox:"0 0 16 16","aria-hidden":"true",fill:"none",stroke:"currentColor",strokeWidth:1.4,strokeLinecap:"round",strokeLinejoin:"round",className:r,children:i}),o[4]=r,o[5]=s):s=o[5],s}let ed="M2.2 5.3c0-.77.53-1.4 1.3-1.4h2.7c.4 0 .77.18 1.02.5l.5.65c.25.32.62.5 1.02.5h3.5c.77 0 1.3.63 1.3 1.4v4.5c0 .77-.53 1.4-1.3 1.4H3.5c-.77 0-1.3-.63-1.3-1.4V5.3Z";function eu(e){let r,i,s,o=(0,n.c)(6),{open:a,className:l}=e;return o[0]!==a?(r=a?(0,t.jsx)("path",{d:ed,fill:"currentColor",stroke:"none",opacity:.3}):null,o[0]=a,o[1]=r):r=o[1],o[2]===Symbol.for("react.memo_cache_sentinel")?(i=(0,t.jsx)("path",{d:ed,strokeWidth:1.1}),o[2]=i):i=o[2],o[3]!==l||o[4]!==r?(s=(0,t.jsxs)(el,{className:l,children:[r,i]}),o[3]=l,o[4]=r,o[5]=s):s=o[5],s}function ep(e){let r,i,s,o=(0,n.c)(4),{className:a}=e;return o[0]===Symbol.for("react.memo_cache_sentinel")?(r=(0,t.jsx)("circle",{cx:"7",cy:"7",r:"4.25"}),i=(0,t.jsx)("path",{d:"M10.3 10.3 14 14",strokeWidth:1.4}),o[0]=r,o[1]=i):(r=o[0],i=o[1]),o[2]!==a?(s=(0,t.jsxs)(el,{className:a,children:[r,i]}),o[2]=a,o[3]=s):s=o[3],s}function em(e){let r,i,s,o,a=(0,n.c)(5),{className:l}=e;return a[0]===Symbol.for("react.memo_cache_sentinel")?(r=(0,t.jsx)("rect",{x:"2",y:"3",width:"12",height:"10",rx:"1.5"}),i=(0,t.jsx)("path",{d:"M4.6 6.6 6.6 8.2 4.6 9.8",strokeWidth:1.1}),s=(0,t.jsx)("path",{d:"M7.8 10h2.8",strokeWidth:1.1}),a[0]=r,a[1]=i,a[2]=s):(r=a[0],i=a[1],s=a[2]),a[3]!==l?(o=(0,t.jsxs)(el,{className:l,children:[r,i,s]}),a[3]=l,a[4]=o):o=a[4],o}function eh(e){let r,i,s,o,a,l=(0,n.c)(6),{className:c}=e;return l[0]===Symbol.for("react.memo_cache_sentinel")?(r=(0,t.jsx)("path",{d:"M4 12.5V9.5",strokeWidth:1.6}),i=(0,t.jsx)("path",{d:"M6.8 12.5V6.5",strokeWidth:1.6}),s=(0,t.jsx)("path",{d:"M9.6 12.5V8",strokeWidth:1.6}),o=(0,t.jsx)("path",{d:"M12.4 12.5V4.5",strokeWidth:1.6}),l[0]=r,l[1]=i,l[2]=s,l[3]=o):(r=l[0],i=l[1],s=l[2],o=l[3]),l[4]!==c?(a=(0,t.jsxs)(el,{className:c,children:[r,i,s,o]}),l[4]=c,l[5]=a):a=l[5],a}let ef="M4.3 2.6h4.8L12 5.5V13a.6.6 0 0 1-.6.6H4.3a.6.6 0 0 1-.6-.6V3.2a.6.6 0 0 1 .6-.6Z",eg="M9 2.8v2.8h2.8";function ey(e){let r,i,s,o,a,l=(0,n.c)(6),{className:c}=e;return l[0]===Symbol.for("react.memo_cache_sentinel")?(r=(0,t.jsx)("circle",{cx:"8",cy:"8",r:"1.1",fill:"currentColor",stroke:"none"}),i=(0,t.jsx)("ellipse",{cx:"8",cy:"8",rx:"6",ry:"2.3",strokeWidth:.9}),s=(0,t.jsx)("ellipse",{cx:"8",cy:"8",rx:"6",ry:"2.3",strokeWidth:.9,transform:"rotate(60 8 8)"}),o=(0,t.jsx)("ellipse",{cx:"8",cy:"8",rx:"6",ry:"2.3",strokeWidth:.9,transform:"rotate(120 8 8)"}),l[0]=r,l[1]=i,l[2]=s,l[3]=o):(r=l[0],i=l[1],s=l[2],o=l[3]),l[4]!==c?(a=(0,t.jsxs)(el,{className:c,children:[r,i,s,o]}),l[4]=c,l[5]=a):a=l[5],a}function ex(e){let r,i,s,o,a=(0,n.c)(5),{className:l}=e;return a[0]===Symbol.for("react.memo_cache_sentinel")?(r=(0,t.jsx)("path",{d:"M6 5.5 3.5 8 6 10.5"}),i=(0,t.jsx)("path",{d:"M10 5.5 12.5 8 10 10.5"}),s=(0,t.jsx)("path",{d:"M9 4.8 7 11.2",strokeWidth:1}),a[0]=r,a[1]=i,a[2]=s):(r=a[0],i=a[1],s=a[2]),a[3]!==l?(o=(0,t.jsxs)(el,{className:l,children:[r,i,s]}),a[3]=l,a[4]=o):o=a[4],o}function eb(e){let r,i,s,o=(0,n.c)(4),{className:a}=e;return o[0]===Symbol.for("react.memo_cache_sentinel")?(r=(0,t.jsx)("path",{d:"M6.7 4c-1 0-1.4.5-1.4 1.4v1c0 .8-.3 1.2-1 1.6.7.4 1 .8 1 1.6v1c0 .9.4 1.4 1.4 1.4"}),i=(0,t.jsx)("path",{d:"M9.3 4c1 0 1.4.5 1.4 1.4v1c0 .8.3 1.2 1 1.6-.7.4-1 .8-1 1.6v1c0 .9-.4 1.4-1.4 1.4"}),o[0]=r,o[1]=i):(r=o[0],i=o[1]),o[2]!==a?(s=(0,t.jsxs)(el,{className:a,children:[r,i]}),o[2]=a,o[3]=s):s=o[3],s}function ev(e){let r,i,s,o,a,l=(0,n.c)(6),{className:c}=e;return l[0]===Symbol.for("react.memo_cache_sentinel")?(r=(0,t.jsx)("path",{d:"M6.6 3.8 5.4 12.2"}),i=(0,t.jsx)("path",{d:"M10.6 3.8 9.4 12.2"}),s=(0,t.jsx)("path",{d:"M4 6.6h8.2"}),o=(0,t.jsx)("path",{d:"M3.8 9.4h8.2"}),l[0]=r,l[1]=i,l[2]=s,l[3]=o):(r=l[0],i=l[1],s=l[2],o=l[3]),l[4]!==c?(a=(0,t.jsxs)(el,{className:c,children:[r,i,s,o]}),l[4]=c,l[5]=a):a=l[5],a}function eS(e){let r,i,s,o,a,l=(0,n.c)(6),{className:c}=e;return l[0]===Symbol.for("react.memo_cache_sentinel")?(r=(0,t.jsx)("path",{d:ef}),i=(0,t.jsx)("path",{d:eg}),s=(0,t.jsx)("path",{d:"M5.7 8.6h4.1",strokeWidth:.95}),o=(0,t.jsx)("path",{d:"M5.7 10.6h4.1",strokeWidth:.95}),l[0]=r,l[1]=i,l[2]=s,l[3]=o):(r=l[0],i=l[1],s=l[2],o=l[3]),l[4]!==c?(a=(0,t.jsxs)(el,{className:c,children:[r,i,s,o]}),l[4]=c,l[5]=a):a=l[5],a}function ew(e){let r,i,s,o,a=(0,n.c)(5),{className:l}=e;return a[0]===Symbol.for("react.memo_cache_sentinel")?(r=(0,t.jsx)("rect",{x:"2.6",y:"3.6",width:"10.8",height:"8.8",rx:"1.3"}),i=(0,t.jsx)("circle",{cx:"5.9",cy:"6.6",r:"1"}),s=(0,t.jsx)("path",{d:"M3.2 11.6 6.4 8.7 8.3 10.4 10.5 8.2 13.2 10.6"}),a[0]=r,a[1]=i,a[2]=s):(r=a[0],i=a[1],s=a[2]),a[3]!==l?(o=(0,t.jsxs)(el,{className:l,children:[r,i,s]}),a[3]=l,a[4]=o):o=a[4],o}function ek(e){let r,i,s,o,a,l,c,d=(0,n.c)(8),{className:u}=e;return d[0]===Symbol.for("react.memo_cache_sentinel")?(r=(0,t.jsx)("path",{d:"M3 5.6h4.1"}),i=(0,t.jsx)("path",{d:"M10.7 5.6h2.3"}),s=(0,t.jsx)("circle",{cx:"8.9",cy:"5.6",r:"1.4"}),o=(0,t.jsx)("path",{d:"M3 10.4h2.3"}),a=(0,t.jsx)("path",{d:"M8.9 10.4h4.1"}),l=(0,t.jsx)("circle",{cx:"7.1",cy:"10.4",r:"1.4"}),d[0]=r,d[1]=i,d[2]=s,d[3]=o,d[4]=a,d[5]=l):(r=d[0],i=d[1],s=d[2],o=d[3],a=d[4],l=d[5]),d[6]!==u?(c=(0,t.jsxs)(el,{className:u,children:[r,i,s,o,a,l]}),d[6]=u,d[7]=c):c=d[7],c}function e_(e){let r,i,s,o=(0,n.c)(4),{className:a}=e;return o[0]===Symbol.for("react.memo_cache_sentinel")?(r=(0,t.jsx)("path",{d:ef}),i=(0,t.jsx)("path",{d:eg}),o[0]=r,o[1]=i):(r=o[0],i=o[1]),o[2]!==a?(s=(0,t.jsxs)(el,{className:a,children:[r,i]}),o[2]=a,o[3]=s):s=o[3],s}let eT=/\.(ico|png|jpe?g|svg|webp|gif|avif)$/;function eA(e){let r,i=(0,n.c)(16),{name:s,className:o}=e,a=s.toLowerCase();if(".gitignore"===a||a.startsWith(".env")||".npmrc"===a||".nvmrc"===a||a.endsWith(".yml")||a.endsWith(".yaml")){let e;return i[0]!==o?(e=(0,t.jsx)(ek,{className:o}),i[0]=o,i[1]=e):e=i[1],e}if(a.endsWith(".tsx")||a.endsWith(".jsx")){let e;return i[2]!==o?(e=(0,t.jsx)(ey,{className:o}),i[2]=o,i[3]=e):e=i[3],e}if(a.endsWith(".json")||a.endsWith(".jsonc")||a.endsWith(".hbs")){let e;return i[4]!==o?(e=(0,t.jsx)(eb,{className:o}),i[4]=o,i[5]=e):e=i[5],e}if(a.endsWith(".ts")||a.endsWith(".mjs")||a.endsWith(".cjs")||a.endsWith(".js")){let e;return i[6]!==o?(e=(0,t.jsx)(ex,{className:o}),i[6]=o,i[7]=e):e=i[7],e}if(a.endsWith(".css")||a.endsWith(".scss")){let e;return i[8]!==o?(e=(0,t.jsx)(ev,{className:o}),i[8]=o,i[9]=e):e=i[9],e}if(a.endsWith(".md")||a.endsWith(".mdx")||a.endsWith(".txt")){let e;return i[10]!==o?(e=(0,t.jsx)(eS,{className:o}),i[10]=o,i[11]=e):e=i[11],e}if(eT.test(a)){let e;return i[12]!==o?(e=(0,t.jsx)(ew,{className:o}),i[12]=o,i[13]=e):e=i[13],e}return i[14]!==o?(r=(0,t.jsx)(e_,{className:o}),i[14]=o,i[15]=r):r=i[15],r}var eN=e.i(880240),eE=e.i(895743),ej=e.i(324090);let eI="flex w-full items-center gap-6 py-3 pr-10 text-left font-mono text-caption-10 uppercase tracking-wide outline-none transition-colors duration-100";function eC(e){let r,i,s,o,a,l,c,d=(0,n.c)(26),{node:u,path:p,depth:m,openPaths:h,activePath:f,onToggle:g,onOpenFile:y}=e;if("folder"===u.type){let e;return d[0]!==f||d[1]!==m||d[2]!==u||d[3]!==y||d[4]!==g||d[5]!==h||d[6]!==p?(e=(0,t.jsx)(eR,{node:u,path:p,depth:m,openPaths:h,activePath:f,onToggle:g,onOpenFile:y}),d[0]=f,d[1]=m,d[2]=u,d[3]=y,d[4]=g,d[5]=h,d[6]=p,d[7]=e):e=d[7],e}let x=14*m+10;d[8]!==x?(r={paddingLeft:x},d[8]=x,d[9]=r):r=d[9];let b=r,v=f===p,S=v?"true":void 0;d[10]!==y||d[11]!==p?(i=()=>y(p),d[10]=y,d[11]=p,d[12]=i):i=d[12];let w=v?"bg-white/[0.06] text-white":"text-white/55 hover:bg-white/[0.04] hover:text-white/90";return d[13]!==w?(s=(0,ea.cx)(eI,"cursor-pointer",w),d[13]=w,d[14]=s):s=d[14],d[15]===Symbol.for("react.memo_cache_sentinel")?(o=(0,t.jsx)("span",{className:"size-[0.85em] shrink-0","aria-hidden":!0}),d[15]=o):o=d[15],d[16]!==u.name?(a=(0,t.jsx)(eA,{name:u.name,className:"text-current/70"}),l=(0,t.jsx)("span",{className:"whitespace-nowrap",children:u.name}),d[16]=u.name,d[17]=a,d[18]=l):(a=d[17],l=d[18]),d[19]!==b||d[20]!==S||d[21]!==i||d[22]!==s||d[23]!==a||d[24]!==l?(c=(0,t.jsx)("li",{children:(0,t.jsxs)("button",{type:"button","aria-current":S,onClick:i,style:b,className:s,children:[o,a,l]})}),d[19]=b,d[20]=S,d[21]=i,d[22]=s,d[23]=a,d[24]=l,d[25]=c):c=d[25],c}function eR(e){let r,i,s,a,l,c,d,u,p,m,h,f,g,y=(0,n.c)(41),{node:x,path:b,depth:v,openPaths:S,activePath:w,onToggle:k,onOpenFile:_}=e;y[0]!==S||y[1]!==b?(r=S.has(b),y[0]=S,y[1]=b,y[2]=r):r=y[2];let T=r,[A,N]=o.useState(T);T&&!A&&N(!0);let E=14*v+10;y[3]!==E?(i={paddingLeft:E},y[3]=E,y[4]=i):i=y[4];let j=i;y[5]!==k||y[6]!==b?(s=()=>k(b),y[5]=k,y[6]=b,y[7]=s):s=y[7],y[8]===Symbol.for("react.memo_cache_sentinel")?(a=(0,ea.cx)(eI,"cursor-pointer text-white/60 hover:bg-white/[0.04] hover:text-white/90"),y[8]=a):a=y[8],y[9]!==T?(l=(0,t.jsx)(ec,{open:T}),c=(0,t.jsx)(eu,{open:T}),y[9]=T,y[10]=l,y[11]=c):(l=y[10],c=y[11]),y[12]!==x.name?(d=(0,t.jsx)("span",{className:"whitespace-nowrap",children:x.name}),y[12]=x.name,y[13]=d):d=y[13],y[14]!==j||y[15]!==T||y[16]!==s||y[17]!==l||y[18]!==c||y[19]!==d?(u=(0,t.jsxs)("button",{type:"button","aria-expanded":T,onClick:s,style:j,className:a,children:[l,c,d]}),y[14]=j,y[15]=T,y[16]=s,y[17]=l,y[18]=c,y[19]=d,y[20]=u):u=y[20];let I=T?"1fr":"0fr";return y[21]!==I?(p={gridTemplateRows:I},y[21]=I,y[22]=p):p=y[22],y[23]!==w||y[24]!==v||y[25]!==A||y[26]!==x.children||y[27]!==_||y[28]!==k||y[29]!==T||y[30]!==S||y[31]!==b?(m=A||T?x.children.map(e=>(0,t.jsx)(eC,{node:e,path:`${b}/${e.name}`,depth:v+1,openPaths:S,activePath:w,onToggle:k,onOpenFile:_},e.name)):null,y[23]=w,y[24]=v,y[25]=A,y[26]=x.children,y[27]=_,y[28]=k,y[29]=T,y[30]=S,y[31]=b,y[32]=m):m=y[32],y[33]!==m?(h=(0,t.jsx)("div",{className:"overflow-hidden",children:(0,t.jsx)("ul",{children:m})}),y[33]=m,y[34]=h):h=y[34],y[35]!==p||y[36]!==h?(f=(0,t.jsx)("div",{className:"grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",style:p,children:h}),y[35]=p,y[36]=h,y[37]=f):f=y[37],y[38]!==f||y[39]!==u?(g=(0,t.jsxs)("li",{children:[u,f]}),y[38]=f,y[39]=u,y[40]=g):g=y[40],g}function eP(){return(0,ej.trackCtaClick)("repo_tree")}let eL=o.memo(function(e){let r,i,s,a,l=(0,n.c)(24),{root:c,footer:d,cta:u,openPaths:p,activePath:m,onToggle:h,onOpenFile:f}=e;if(l[0]!==m||l[1]!==u||l[2]!==f||l[3]!==h||l[4]!==p||l[5]!==c.children||l[6]!==c.name){let e;l[8]!==m||l[9]!==u||l[10]!==f||l[11]!==h||l[12]!==p||l[13]!==c.name?(e=e=>(0,t.jsxs)(o.Fragment,{children:[(0,t.jsx)(eC,{node:e,path:`${c.name}/${e.name}`,depth:0,openPaths:p,activePath:m,onToggle:h,onOpenFile:f}),u?.link.href&&"file"===e.type&&"README.md"===e.name?(0,t.jsx)("li",{children:(0,t.jsxs)(eE.SanityLink,{link:u.link,onClick:eP,"aria-label":`${u.fileLabel}: get access`,style:{paddingLeft:10},className:(0,ea.cx)(eI,"text-[#d6a878] no-underline hover:bg-white/[0.06]"),children:[(0,t.jsx)("span",{className:"size-[0.85em] shrink-0","aria-hidden":!0}),(0,t.jsx)("span",{className:"flex size-[1.05em] shrink-0 items-center justify-center",children:(0,t.jsx)(eN.PulseDot,{size:"size-[0.4em]"})}),(0,t.jsx)("span",{className:"whitespace-nowrap",children:u.fileLabel})]})}):null]},e.name),l[8]=m,l[9]=u,l[10]=f,l[11]=h,l[12]=p,l[13]=c.name,l[14]=e):e=l[14],r=c.children.map(e),l[0]=m,l[1]=u,l[2]=f,l[3]=h,l[4]=p,l[5]=c.children,l[6]=c.name,l[7]=r}else r=l[7];return l[15]!==r?(i=(0,t.jsx)("div",{className:"scrollbar-thin min-h-0 flex-1 overflow-auto py-12",children:(0,t.jsx)("ul",{className:"w-max min-w-full",children:r})}),l[15]=r,l[16]=i):i=l[16],l[17]!==m||l[18]!==d||l[19]!==f?(s=d.length>0?(0,t.jsx)("ul",{"aria-label":"Pinned",className:"shrink-0 py-12",children:d.map(e=>{let n=m===e.name;return(0,t.jsx)("li",{children:(0,t.jsxs)("button",{type:"button","aria-current":n?"true":void 0,onClick:()=>f(e.name),style:{paddingLeft:10},className:(0,ea.cx)(eI,"cursor-pointer",n?"bg-white/[0.06] text-white":"text-white/45 hover:bg-white/[0.04] hover:text-white/80"),children:[(0,t.jsx)(eA,{name:e.name,className:"text-current/70"}),(0,t.jsx)("span",{className:"truncate",children:e.name})]})},e.name)})}):null,l[17]=m,l[18]=d,l[19]=f,l[20]=s):s=l[20],l[21]!==i||l[22]!==s?(a=(0,t.jsxs)("nav",{"aria-label":"File explorer",className:"flex min-h-0 flex-1 flex-col justify-between gap-16",children:[i,s]}),l[21]=i,l[22]=s,l[23]=a):a=l[23],a});var eM=e.i(648322),eD=e.i(642623),eU=e.i(88771);let eO=[.23,1,.32,1];function e$(e){let r,i,s,a,l,c,d,u,p,m,h,f,g,y,x,b,v,S,w=(0,n.c)(45),{files:k,onOpenFile:_,onClose:T}=e,[A,N]=o.useState(""),[E,j]=o.useState(0),I=(0,eM.useClickOutside)(T),C=o.useRef(null),R=(0,eU.usePrefersReducedMotion)();w[0]!==R?(r=R?{duration:0}:{duration:.18,ease:eO},w[0]=R,w[1]=r):r=w[1];let P=r;if(w[2]!==k||w[3]!==A){e:{let e=A.trim().toLowerCase();if(!e){let e;w[5]!==k?(e=k.slice(0,40),w[5]=k,w[6]=e):e=w[6],i=e;break e}i=k.map(t=>{let n;return{file:t,rank:(n=t.name.toLowerCase()).startsWith(e)?0:n.includes(e)?1:t.path.toLowerCase().includes(e)?2:-1}}).filter(eG).sort(eW).slice(0,40).map(eF)}w[2]=k,w[3]=A,w[4]=i}else i=w[4];let L=i,M=Math.min(E,Math.max(L.length-1,0));w[7]!==M?(s=()=>{let e=C.current?.children[M];e?.scrollIntoView({block:"nearest"})},a=[M],w[7]=M,w[8]=s,w[9]=a):(s=w[8],a=w[9]),o.useEffect(s,a),w[10]!==M||w[11]!==T||w[12]!==_||w[13]!==L?(l=e=>{if("ArrowDown"===e.key)e.preventDefault(),j(e=>Math.min(e+1,L.length-1));else if("ArrowUp"===e.key)e.preventDefault(),j(eB);else if("Enter"===e.key){e.preventDefault();let t=L[M];t&&_(t.path)}else"Escape"===e.key&&(e.preventDefault(),T())},w[10]=M,w[11]=T,w[12]=_,w[13]=L,w[14]=l):l=w[14];let D=l;return w[15]===Symbol.for("react.memo_cache_sentinel")?(c={opacity:0},d={opacity:1},u={opacity:0},w[15]=c,w[16]=d,w[17]=u):(c=w[15],d=w[16],u=w[17]),w[18]!==P?(p=(0,t.jsx)(eD.div,{className:"absolute inset-0 bg-black-deep/50",initial:c,animate:d,exit:u,transition:P}),w[18]=P,w[19]=p):p=w[19],w[20]!==R?(m=R?{opacity:0}:{opacity:0,y:-8,scale:.98},h=R?{opacity:1}:{opacity:1,y:0,scale:1},f=R?{opacity:0}:{opacity:0,y:-8,scale:.98},w[20]=R,w[21]=m,w[22]=h,w[23]=f):(m=w[21],h=w[22],f=w[23]),w[24]===Symbol.for("react.memo_cache_sentinel")?(g=e=>{N(e.target.value),j(0)},w[24]=g):g=w[24],w[25]!==D||w[26]!==A?(y=(0,t.jsx)("input",{autoFocus:!0,type:"text","aria-label":"Search project files",placeholder:"Search project files...",value:A,onChange:g,onKeyDown:D,className:"shrink-0 border-white/10 border-b bg-transparent px-16 py-12 font-mono text-caption-10 text-white caret-accent outline-none placeholder:text-white/30"}),w[25]=D,w[26]=A,w[27]=y):y=w[27],w[28]!==M||w[29]!==_||w[30]!==L?(x=0===L.length?(0,t.jsx)("div",{className:"px-16 py-12 font-mono text-caption-10 text-white/30",children:"No files match that search"}):L.map((e,n)=>{let r=e.path.slice(0,e.path.length-e.name.length);return(0,t.jsxs)("button",{type:"button",onClick:()=>_(e.path),onMouseMove:()=>j(n),className:(0,ea.cx)("flex w-full cursor-pointer items-center gap-10 px-16 py-6 text-left font-mono text-caption-10",n===M?"bg-white/10":"hover:bg-white/[0.04]"),children:[(0,t.jsx)(eA,{name:e.name,className:"text-white/50"}),(0,t.jsx)("span",{className:"shrink-0 text-white/90",children:e.name}),(0,t.jsx)("span",{className:"truncate text-white/35",children:r})]},e.path)}),w[28]=M,w[29]=_,w[30]=L,w[31]=x):x=w[31],w[32]!==x?(b=(0,t.jsx)("div",{ref:C,className:"scrollbar-thin min-h-0 flex-1 overflow-y-auto py-6",children:x}),w[32]=x,w[33]=b):b=w[33],w[34]!==I||w[35]!==m||w[36]!==h||w[37]!==f||w[38]!==y||w[39]!==b||w[40]!==P?(v=(0,t.jsxs)(eD.div,{ref:I,initial:m,animate:h,exit:f,transition:P,className:"relative mt-10 flex max-h-[min(70%,440px)] w-[min(92%,560px)] flex-col overflow-hidden rounded-8 bg-black shadow-2xl ring-1 ring-white/15",children:[y,b]}),w[34]=I,w[35]=m,w[36]=h,w[37]=f,w[38]=y,w[39]=b,w[40]=P,w[41]=v):v=w[41],w[42]!==v||w[43]!==p?(S=(0,t.jsxs)("div",{className:"absolute inset-0 z-3 flex items-start justify-center",children:[p,v]}),w[42]=v,w[43]=p,w[44]=S):S=w[44],S}function eB(e){return Math.max(e-1,0)}function eF(e){return e.file}function eW(e,t){return e.rank-t.rank||e.file.name.localeCompare(t.file.name)}function eG(e){return e.rank>=0}var ez=e.i(988051);let eH="are you sure? [y/N]",eY=["rm: it is dangerous to operate recursively on '/'"],eV=["/bin/bash","/bin/ls","/boot/vmlinuz-6.8.0-edo","/etc/passwd","/etc/shadow","/etc/fstab","/usr/lib/x86_64-linux-gnu/libc.so.6","/usr/bin/node","/usr/bin/git","/lib/systemd/systemd","/var/lib/dpkg/status","/var/log/syslog","/home/edo/.ssh/id_rsa","/home/edo/.bashrc","/sbin/init"],eX=["rm: cannot remove '/proc/1/exe': Operation not permitted","bash: /bin/bash: No such file or directory","[ 1234.882043] EXT4-fs error (device sda1): ext4_lookup: deleted inode referenced","[ 1235.014773] systemd[1]: Failed to execute /sbin/init, giving up"];var eK=e.i(772742);let eq=["·","░","▒","▓","█"],eQ=["help","ls","cd","tree","cat","open","grep","plop","history","pwd","whoami","echo","clear"],eJ=new Set(["cd","ls","cat","open","tree"]),eZ={ll:"ls",cls:"clear"},e0="/home/edo";function e1(e){return e.join("/")}function e2(e){return 0===e.length?"~":`~/${e.join("/")}`}function e3(e,t){if(0===t.length)return[e.root,...e.footer];let n=e.root;for(let e=1;e<t.length;e++){let r=n.children.find(n=>"folder"===n.type&&n.name===t[e]);if(!r)return[];n=r}return n.children}function e4(e,t,n){let r=n.trim();if(""===r||"~"===r)return{type:"dir",segments:[]};let i=r.startsWith("~/")||r.startsWith("/"),s=i?[]:[...t],o=(i?r.replace(/^~?\//,""):r).split("/").filter(e=>e.length>0);for(let[t,n]of o.entries()){if("."===n)continue;if(".."===n){s=s.slice(0,-1);continue}let i=e3(e,s).find(e=>e.name===n);if(!i)return{type:"error",message:`${r}: No such file or directory`};if("folder"===i.type){s=[...s,n];continue}if(t<o.length-1)return{type:"error",message:`${n}: Not a directory`};return{type:"file",segments:[...s,n],file:i}}return{type:"dir",segments:s}}function e6(e){return e.map(e=>"folder"===e.type?`${e.name}/`:e.name)}function e5(e,t){var n,r,i;let{data:s,cwd:o,readFile:a,history:l,repo:c}=t,d=function(e){let[t,...n]=e.split(/\s+/);if(".."===t)return["cd","..",...n].join(" ");if("..."===t)return["cd","../..",...n].join(" ");let r=t?eZ[t]:void 0;return r?[r,...n].join(" "):e}(e.trim());if(0===d.length)return{output:[]};if(function(e){let[t,...n]=e.trim().replace(/^sudo\s+/i,"").split(/\s+/).filter(Boolean);if("rm"!==t)return!1;let r=!1,i=!1,s=!1,o=[];for(let e of n)"--no-preserve-root"===e?s=!0:"--recursive"===e?r=!0:"--force"===e?i=!0:e.startsWith("--")||(e.startsWith("-")?(r=r||/[rR]/.test(e),i=i||e.includes("f")):o.push(e));return!!(r&&i)&&(0===o.length||o.some(e=>"/"===e||"/*"===e)||s)}(d))return{output:eY,selfDestruct:!0};let[u="",...p]=d.split(/\s+/),m=p.join(" ");if("clear"===u)return{output:[],clear:!0};if("help"===u){let e=c?[...eQ,"git"]:eQ;return{output:[`commands: ${e.join(", ")}`,"tab completes paths, up/down recalls history"]}}if("git"===u){let e,t;return c?{output:(e=null!==c.totalCommits?`${c.totalCommits.toLocaleString("en-US")} commits`:"commits",t=`${c.branch} \xb7 ${c.updatedLabel} \xb7 ${e}`,0===c.weeks.length?[t]:[t,"",...function(e){let t=e.slice(-26),n=Math.max(0,...t),r=t.map(e=>{if(e<=0||n<=0)return{height:0,ch:eq[0]};let t=e/n;return{height:Math.max(1,Math.round(7*t)),ch:eq[t>.75?4:t>.5?3:t>.25?2:1]??eq[1]}}),i=[];for(let e=0;e<7;e++){let t=7-e;i.push(r.map(e=>e.height>=t?e.ch:eq[0]).join(""))}return i}(c.weeks),"",`less ${eq.join("")} more   (last ${Math.min(c.weeks.length,26)} weeks \xb7 commit volume, not contents)`])}:{output:["git: repository activity unavailable"]}}if("whoami"===u)return{output:["edo"]};if("echo"===u)return{output:[m]};if("pwd"===u)return{output:[0===o.length?e0:`${e0}/${o.join("/")}`]};if("history"===u)return{output:l.map((e,t)=>`${String(t+1).padStart(4," ")}  ${e}`)};if("plop"===u)return{output:[],plop:{generator:m}};if("cd"===u){let e=e4(s,o,m);return"error"===e.type?{output:[`cd: ${e.message}`]}:"file"===e.type?{output:[`cd: ${m}: Not a directory`]}:{output:[],cwd:e.segments}}if("ls"===u){if(0===m.length)return{output:e6(e3(s,o))};let e=e4(s,o,m);return"error"===e.type?{output:[`ls: ${e.message}`]}:"file"===e.type?{output:[m]}:{output:e6(e3(s,e.segments))}}if("tree"===u){let e,t,i,a,l=[...p],c=1/0,d="";for(;l.length>0;){let e=l.shift();if("-L"===e){let e=Number(l.shift());Number.isFinite(e)&&e>0&&(c=Math.floor(e))}else e&&(d=e)}let u=d?e4(s,o,d):{type:"dir",segments:o};if("error"===u.type)return{output:[`tree: ${u.message}`]};if("file"===u.type)return{output:[d]};let{lines:m,dirs:h,files:f}=(n=u.segments,r=c,e=[],t=0,i=0,(a=(n,o,l)=>{l>r||e3(s,n).forEach((r,s,c)=>{let d=s===c.length-1,u="folder"===r.type;e.push(`${o}${d?"└── ":"├── "}${r.name}${u?"/":""}`),u?(t+=1,a([...n,r.name],`${o}${d?"    ":"│   "}`,l+1)):i+=1})})(n,"",1),{lines:e,dirs:t,files:i});return{output:[d||".",...m,"",`${h} ${1===h?"directory":"directories"}, ${f} ${1===f?"file":"files"}`]}}if("cat"===u){let e=e4(s,o,m);return"error"===e.type?{output:[`cat: ${e.message}`]}:"dir"===e.type?{output:[`cat: ${m}: Is a directory`]}:{output:(a(e1(e.segments))??"").split("\n")}}if("open"===u){let e=e4(s,o,m);return"error"===e.type?{output:[`open: ${e.message}`]}:"dir"===e.type?{output:[`open: ${m}: Is a directory`]}:{output:[`opening ${e.file.name}`],open:e1(e.segments)}}if("grep"===u){let e,t,[n,r]=p;if(!n)return{output:["usage: grep <pattern> [path]"]};let l=r?e4(s,o,r):{type:"dir",segments:o};if("error"===l.type)return{output:[`grep: ${l.message}`]};let c="file"===l.type?[{segments:l.segments,file:l.file}]:(i=l.segments,e=[],(t=n=>{for(let r of e3(s,n)){let i=[...n,r.name];"folder"===r.type?t(i):e.push({segments:i,file:r})}})(i),e),d=n.toLowerCase(),u=[],m=!1;for(let e of c){for(let[t,n]of(a(e1(e.segments))??"").split("\n").entries())if(n.toLowerCase().includes(d)){if(u.length>=100){m=!0;break}u.push(`${function(e,t){return(t.every((t,n)=>e[n]===t)?e.slice(t.length):e).join("/")}(e.segments,o)}:${t+1}: ${n.trim().slice(0,100)}`)}if(m)break}return 0===u.length?{output:[`grep: no matches for "${n}"`]}:(m&&u.push("... stopped at 100 matches"),{output:u})}let h=function(e){let t=null,n=1/0;for(let r of eQ){let i=function(e,t){if(0===e.length)return t.length;if(0===t.length)return e.length;let n=Array.from({length:t.length+1},(e,t)=>t);for(let r=1;r<=e.length;r++){let i=[r];for(let s=1;s<=t.length;s++){let o=+(e[r-1]!==t[s-1]),a=(n[s]??0)+1,l=(i[s-1]??0)+1,c=(n[s-1]??0)+o;i.push(Math.min(a,l,c))}n=i}return n[t.length]??0}(e,r);i<n&&(n=i,t=r)}return null!==t&&n<=2?t:null}(u),f=[`command not found: ${u}`];return h&&f.push(`did you mean: ${h}?`),{output:f}}function e8(e){let[t,...n]=e;if(void 0===t)return"";let r=t;for(let e of n){let t=0;for(;t<r.length&&t<e.length&&r[t]===e[t];)t++;if(""===(r=r.slice(0,t)))break}return r}var e7=e.i(239262),e9=e.i(46995);let te=o.memo(function({data:e,cta:n,hint:r,repo:i,pendingCommand:s,onCommandConsumed:a,readFile:l,onOpenFile:c,onGenerate:d,autoFocus:m}){let{prompt:h}=e.terminal,f=e2([e.root.name]),g=o.useRef(null);null===g.current&&(g.current=function(e,t){let{initialCommand:n}=e.terminal;return n?{cwd:e5(n,{data:e,cwd:[],readFile:t,history:[]}).cwd??[],history:[]}:{cwd:[],history:[]}}(e,l));let[y,x]=o.useState(g.current.cwd),[b,v]=o.useState(g.current.history),[S,w]=o.useState(""),[k,_]=o.useState([]),[T,A]=o.useState(null),[N,E]=o.useState(null),[j,I]=o.useState(null),[C,R]=o.useState(null),[P,L]=o.useState(!1),[M,D]=o.useState(null),[U,O]=o.useState(!1),$=o.useRef(null),B=o.useRef(null);o.useEffect(()=>{m&&B.current?.focus({preventScroll:!0})},[m]),o.useEffect(()=>{let e=$.current;e&&(e.scrollTop=e.scrollHeight)},[b]),o.useEffect(()=>{if(!j)return;let e=j.steps[j.index];if(!e){d(j.ops,j.openPath),R(null),I(null);return}e.task&&R(e.text);let t=setTimeout(()=>{v(t=>t.map((n,r)=>r===t.length-1?{...n,output:[...n.output,`✔  ${e.text}`]}:n)),R(null),I(e=>e?{...e,index:e.index+1}:null)},e.task?760:120);return()=>clearTimeout(t)},[j,d]),o.useEffect(()=>{if(!M)return;let e=M.frames[M.index];if(!e){O(!0),D(null),(0,ej.trackCrashScreenEasterEgg)();return}let t=setTimeout(()=>{e.spinner||v(t=>t.map((n,r)=>r===t.length-1?{...n,output:[...n.output,e.text]}:n)),D(e=>e?{...e,index:e.index+1}:null)},e.delay);return()=>clearTimeout(t)},[M]);let F=e=>{v(t=>[...t,e])},W=()=>`${e2(y)} ${h}`,G=(t,n,r)=>{let i=t.prompts[n];if(!i){let n;return void(n=function(e,t,n){let r,i=[],s=[],o=new Map,a=e=>o.get(e)??n.readFile(e)??"";for(let l of e.actions){if("run"===l.type){s.push({text:l.description,task:!0});continue}let e=u(l.path,t).replace(/^\.\//,"").replace(/^\//,""),c=`${n.rootName}/${e}`;if("add"===l.type){let n=u(l.template,t);o.set(c,n),i.push({kind:"add",path:c,content:n}),s.push({text:`++ /${e}`,task:!1}),r=c;continue}let d=a(c).replace(l.pattern,u(l.template,t));o.set(c,d),i.push({kind:"modify",path:c,content:d}),s.push({text:`|- /${e}`,task:!1})}return{ops:i,steps:s,openPath:r}}(t,r,{rootName:e.root.name,readFile:l}),F({prefix:"?",command:`Running "${t.id}"`,output:[]}),E(null),I({steps:n.steps,index:0,ops:n.ops,openPath:n.openPath}))}F({prefix:"?",command:i.message,output:[]}),E({step:"prompt",generator:t,index:n,answers:r})},z=t=>{let n=e5(t,{data:e,cwd:y,readFile:l,history:k,repo:i});n.clear?v([]):F({prefix:W(),command:t,output:n.output}),n.cwd&&x(n.cwd),n.open&&c(n.open),t.trim().length>0&&_(e=>[...e,t]),A(null),n.plop&&(t=>{let n=t.trim();if(n.length>0){let t=p(e.generators,n);return t?G(t,0,{}):F({prefix:"?",command:"",output:[`plop: no generator matching "${n}"`]})}let[r,...i]=e.generators;r&&0===i.length?G(r,0,{}):(F({prefix:"?",command:"Select a generator",output:e.generators.map((e,t)=>`  ${t+1})  ${e.id}`)}),E({step:"select"}))})(n.plop.generator),n.selfDestruct&&L(!0)},H=o.useRef(null);o.useEffect(()=>{if(!s){H.current=null;return}H.current!==s&&(H.current=s,j||M||P||N||z(s),a?.())},[s]);let Y=t=>{if(t.preventDefault(),!j&&!M){if(P){let e=S.trim().toLowerCase(),t="y"===e||"yes"===e;F({prefix:eH,command:S,output:t?[]:["rm: aborted, the filesystem is intact."]}),L(!1),A(null),w(""),t&&((0,eK.primeBiosAudio)(),D({frames:function(){let e=[];for(let t of(eV.forEach((t,n)=>{e.push({text:`removed '${t}'`,delay:55+n%4*18})}),eX))e.push({text:t,delay:230});return e.push({text:"Syncing filesystem...",delay:1150,spinner:!0}),e.push({text:"[ 1235.330012] Kernel panic - not syncing: Attempted to kill init! exitcode=0x00000100",delay:420}),e.push({text:"[ 1235.330013] ---[ end Kernel panic - not syncing ]---",delay:360}),e.push({text:"System halted. Rebooting...",delay:950}),e.push({text:"",delay:600}),e}(),index:0}));return}if(N){A(null),w(""),((t,n)=>{if("select"===t.step){F({prefix:"❯",command:n,output:[]});let t=p(e.generators,n);return t?G(t,0,{}):F({prefix:"?",command:"",output:[`no generator matching "${n}"`]})}let r=t.generator.prompts[t.index];if(!r)return E(null);let i=!r.validate||r.validate(n);if(!0!==i)return F({prefix:"❯",command:n,output:[`>> ${i}`]});F({prefix:"❯",command:n,output:[]});let s=r.filter?r.filter(n):n;G(t.generator,t.index+1,{...t.answers,[r.name]:s})})(N,S);return}z(S),w("")}},V=t=>{if(P)return void("Escape"===t.key?(t.preventDefault(),F({prefix:eH,command:"^C",output:["rm: aborted, the filesystem is intact."]}),L(!1),w("")):"Tab"===t.key&&t.preventDefault());if(N)return void("Escape"===t.key?(t.preventDefault(),F({prefix:"?",command:"aborted",output:[]}),E(null),w("")):"Tab"===t.key&&t.preventDefault());if(t.ctrlKey&&"l"===t.key.toLowerCase()){t.preventDefault(),v([]);return}if("ArrowUp"===t.key){if(0===k.length)return;t.preventDefault();let e=null===T?k.length-1:Math.max(0,T-1);A(e),w(k[e]??"");return}if("ArrowDown"===t.key){if(null===T)return;t.preventDefault();let e=T+1;if(e>=k.length){A(null),w("");return}A(e),w(k[e]??"");return}if("Tab"===t.key&&!t.shiftKey){if(0===S.trim().length)return;t.preventDefault(),(()=>{let t=S.match(/^\s*/)?.[0]??"",n=S.slice(t.length);if(!/\s/.test(n)){let e=eQ.filter(e=>e.startsWith(n));if(0===e.length)return;if(1===e.length)return w(`${t}${e[0]} `);F({prefix:W(),command:S,output:[e.join("  ")]});let r=e8(e);return r.length>n.length&&w(`${t}${r}`)}let r=n.split(/\s+/)[0]??"";if(!eJ.has(r))return;let i=S.match(/\S*$/)?.[0]??"",{dirPart:s,base:o,matches:a}=function(e,t,n,r){let i,s=r.lastIndexOf("/"),o=-1===s?"":r.slice(0,s+1),a=-1===s?r:r.slice(s+1);if(""===o)i=t;else{let n=e4(e,t,o);i="dir"===n.type?n.segments:null}if(null===i)return{dirPart:o,base:a,matches:[]};let l="cd"===n,c=e3(e,i).filter(e=>!l||"folder"===e.type).filter(e=>e.name.startsWith(a)).map(e=>({name:e.name,isDir:"folder"===e.type}));return{dirPart:o,base:a,matches:c}}(e,y,r,i);if(0===a.length)return;let l=S.slice(0,S.length-i.length);if(1===a.length){let[e]=a;if(!e)return;w(`${l}${s}${e.name}${e.isDir?"/":" "}`);return}F({prefix:W(),command:S,output:[a.map(e=>`${e.name}${e.isDir?"/":""}`).join("  ")]});let c=e8(a.map(e=>e.name));c.length>o.length&&w(`${l}${s}${c}`)})()}},X=P?eH:N?"❯":W(),K=P?"y / N":0!==k.length||N?void 0:r,q=!!n?.link.href&&!N&&!P,Q=M?M.frames[M.index]:null,J=Q?.spinner?Q.text:null,Z=j?C??"scaffolding":J;return(0,t.jsxs)("section",{"aria-label":"Terminal",className:"flex h-full min-h-0 flex-col",children:[(0,t.jsx)("div",{className:"shrink-0 border-white/10 border-b px-16 py-8 font-mono text-caption-10 text-white/40 uppercase tracking-wide",children:"Terminal"}),(0,t.jsxs)("div",{ref:$,onClick:()=>{let e=window.getSelection();e&&e.toString().length>0||B.current?.focus({preventScroll:!0})},className:"scrollbar-thin min-h-0 flex-1 overflow-y-auto px-16 py-10 font-mono text-caption-10 leading-relaxed",children:[b.map((e,n)=>(0,t.jsxs)("div",{className:"whitespace-pre-wrap break-words",children:[(0,t.jsxs)("div",{className:"text-white/80",children:[(0,t.jsxs)("span",{className:"select-none text-white/40",children:[e.prefix," "]}),e.command]}),e.output.map((e,n)=>(0,t.jsx)("div",{className:"text-white/50",children:e.length>0?e:" "},n))]},n)),(0,e9.run)(()=>null!==Z?(0,t.jsxs)("div",{className:"flex items-center gap-8 text-white/50",children:[(0,t.jsx)("span",{"aria-hidden":!0,className:"size-12 shrink-0 animate-spin rounded-full border border-white/20 border-t-white/70 motion-reduce:animate-none"}),(0,t.jsx)("span",{children:Z})]}):M?null:(0,t.jsxs)(t.Fragment,{children:[q&&n?(0,t.jsxs)(eE.SanityLink,{link:n.link,onClick:()=>(0,ej.trackCtaClick)("repo_terminal"),"aria-label":`${n.label}: get access`,className:"group block whitespace-pre-wrap break-words text-white/80 no-underline",children:[(0,t.jsx)("span",{className:"select-none text-white/40",children:`${f} ${h} `}),(0,t.jsx)("span",{className:"text-[#d6a878] group-hover:underline",children:n.label}),n.note?(0,t.jsx)("span",{className:"select-none text-white/40",children:`   # ${n.note}`}):null]}):null,(0,t.jsxs)("form",{onSubmit:Y,className:"flex items-center text-white/80",children:[(0,t.jsxs)("span",{className:"select-none text-white/40",children:[X," "]}),(0,t.jsx)("input",{ref:B,type:"text","aria-label":"Terminal input",spellCheck:!1,autoCapitalize:"off",autoCorrect:"off",autoComplete:"off",placeholder:K,value:S,onChange:e=>w(e.target.value),onKeyDown:V,className:"min-w-0 flex-1 bg-transparent font-mono text-caption-10 caret-current outline-none ring-0 placeholder:text-white/25 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"})]})]}))]}),U?(0,t.jsx)(e7.Portal,{children:(0,t.jsx)(ez.CrashScreen,{})}):null]})});function tt(e){let r,i=(0,n.c)(3),{repo:s,variant:a,onShowActivity:l}=e;if(!s)return null;let c=o.use(s)[a]??null;return c?(i[0]!==l||i[1]!==c?(r=(0,t.jsx)(tr,{status:c,onShowActivity:l}),i[0]=l,i[1]=c,i[2]=r):r=i[2],r):null}function tn(){let e,r=(0,n.c)(1);return r[0]===Symbol.for("react.memo_cache_sentinel")?(e=(0,t.jsx)("div",{className:"h-28 shrink-0 border-white/10 border-t"}),r[0]=e):e=r[0],e}function tr(e){let r,i,s,o,a,l,c,d,u,p,m,h,f,g=(0,n.c)(27),{status:y,onShowActivity:x}=e,{branch:b,updatedLabel:v,isRecent:S,totalCommits:w}=y;g[0]===Symbol.for("react.memo_cache_sentinel")?(r=(0,t.jsx)("span",{"aria-hidden":!0,className:"text-white/30",children:"⎇"}),g[0]=r):r=g[0],g[1]!==b?(i=(0,t.jsxs)("span",{className:"flex shrink-0 items-center gap-5",children:[r,b]}),g[1]=b,g[2]=i):i=g[2],g[3]===Symbol.for("react.memo_cache_sentinel")?(s=(0,t.jsx)("span",{className:"hidden h-10 w-px shrink-0 bg-white/10 sm:block"}),g[3]=s):s=g[3];let k=S?"animate-pulse bg-[#d6a878] motion-reduce:animate-none":"bg-white/25";return g[4]!==k?(o=(0,ea.cx)("size-6 shrink-0 rounded-full",k),g[4]=k,g[5]=o):o=g[5],g[6]!==o?(a=(0,t.jsx)("span",{"aria-hidden":!0,className:o}),g[6]=o,g[7]=a):a=g[7],g[8]!==v?(l=(0,t.jsx)("span",{className:"truncate",children:v}),g[8]=v,g[9]=l):l=g[9],g[10]!==a||g[11]!==l?(c=(0,t.jsxs)("span",{className:"flex min-w-0 items-center gap-6",children:[a,l]}),g[10]=a,g[11]=l,g[12]=c):c=g[12],g[13]!==i||g[14]!==c?(d=(0,t.jsxs)("div",{className:"flex min-w-0 items-center gap-10",children:[i,s,c]}),g[13]=i,g[14]=c,g[15]=d):d=g[15],g[16]===Symbol.for("react.memo_cache_sentinel")?(u=(0,t.jsx)(eh,{className:"text-white/30"}),g[16]=u):u=g[16],g[17]!==w?(p=null!==w?`${w.toLocaleString("en-US")} commits`:"activity",g[17]=w,g[18]=p):p=g[18],g[19]!==p?(m=(0,t.jsx)("span",{className:"leading-none",children:p}),g[19]=p,g[20]=m):m=g[20],g[21]!==x||g[22]!==m?(h=(0,t.jsxs)("button",{type:"button",onClick:x,title:"Show the commit graph","aria-label":"Show the commit graph in the terminal",className:"flex shrink-0 cursor-pointer items-center gap-6 rounded-4 px-6 py-3 uppercase leading-none tracking-wide transition-colors hover:bg-white/10 hover:text-white",children:[u,m]}),g[21]=x,g[22]=m,g[23]=h):h=g[23],g[24]!==h||g[25]!==d?(f=(0,t.jsxs)("div",{className:"flex h-28 shrink-0 items-center justify-between gap-12 border-white/10 border-t px-16 font-mono text-caption-10 text-white/40 uppercase tracking-wide",children:[d,h]}),g[24]=h,g[25]=d,g[26]=f):f=g[26],f}var ti=e.i(790815);function ts(e){let r,i,s=(0,n.c)(8),{variant:o,pending:a,onSelect:l}=e,c=(0,eU.usePrefersReducedMotion)(),d=a??o;return s[0]!==d||s[1]!==l||s[2]!==a||s[3]!==c||s[4]!==o?(r=H.map(e=>{let{id:n,label:r}=e;return(0,t.jsxs)("button",{type:"button","aria-label":`Open the ${r} repository`,"aria-pressed":n===o,"aria-busy":a===n,onClick:()=>l(n),className:(0,ea.cx)("relative cursor-pointer rounded-4 px-6 py-2 font-mono text-caption-10 uppercase tracking-wide transition-colors",n===d?"text-white":"text-white/40 hover:text-white",a===n&&"animate-pulse"),children:[n===d?(0,t.jsx)(ti.span,{layoutId:"ide-variant-highlight","aria-hidden":"true",className:"absolute inset-0 rounded-4 bg-white/10",transition:c?{duration:0}:{type:"spring",stiffness:550,damping:45,mass:1}}):null,(0,t.jsx)("span",{className:"relative",children:r})]},n)}),s[0]=d,s[1]=l,s[2]=a,s[3]=c,s[4]=o,s[5]=r):r=s[5],s[6]!==r?(i=(0,t.jsx)("div",{className:"relative isolate flex items-center gap-2 rounded-4 bg-white/5 p-2",children:r}),s[6]=r,s[7]=i):i=s[7],i}function to(e){let r,i,s,o,a,l,c=(0,n.c)(19),{ref:d,title:u,variant:p,pendingVariant:m,onSelectVariant:h,actions:f,className:g,children:y}=e;return c[0]!==g?(r=(0,ea.cx)("relative isolate flex h-full flex-col overflow-hidden rounded-4 bg-black text-white ring-1 ring-white/10",g),c[0]=g,c[1]=r):r=c[1],c[2]!==h||c[3]!==m||c[4]!==p?(i=(0,t.jsx)("div",{className:"absolute top-1/2 left-8 -translate-y-1/2",children:(0,t.jsx)(ts,{variant:p,pending:m,onSelect:h})}),c[2]=h,c[3]=m,c[4]=p,c[5]=i):i=c[5],c[6]!==u?(s=(0,t.jsx)("span",{className:"max-w-1/3 truncate font-mono text-caption-10 text-white/40 uppercase tracking-wide",children:u}),c[6]=u,c[7]=s):s=c[7],c[8]!==f?(o=f?(0,t.jsx)("div",{className:"absolute top-1/2 right-8 flex -translate-y-1/2 items-center gap-4",children:f}):null,c[8]=f,c[9]=o):o=c[9],c[10]!==i||c[11]!==s||c[12]!==o?(a=(0,t.jsxs)("div",{className:"relative flex h-34 shrink-0 items-center justify-center border-white/10 border-b px-16",children:[i,s,o]}),c[10]=i,c[11]=s,c[12]=o,c[13]=a):a=c[13],c[14]!==y||c[15]!==d||c[16]!==r||c[17]!==a?(l=(0,t.jsxs)("div",{ref:d,className:r,children:[a,y]}),c[14]=y,c[15]=d,c[16]=r,c[17]=a,c[18]=l):l=c[18],l}function ta(e){let r,i,s,o,a,l,c=(0,n.c)(17),{title:d,variant:u,pendingVariant:p,onSelectVariant:m}=e;c[0]!==u?(r=H.find(e=>e.id===u)?.label??u,c[0]=u,c[1]=r):r=c[1];let h=r;return c[2]!==u?(i=(0,t.jsxs)("span",{className:"text-white/40",children:["> ",(0,t.jsxs)("span",{className:"text-[#d6a878]",children:["cd the-content-architecture-",u]})]}),c[2]=u,c[3]=i):i=c[3],c[4]!==h?(s=(0,t.jsxs)("span",{className:"text-ghost-grey",children:[h,": repository not open yet"]}),o=(0,t.jsxs)("span",{className:"max-w-460 text-dark-grey",children:["The ",h," edition is in development. Switch back to Next.js to read the repo you get today."]}),c[4]=h,c[5]=s,c[6]=o):(s=c[5],o=c[6]),c[7]!==i||c[8]!==s||c[9]!==o?(a=(0,t.jsxs)("div",{className:"flex min-h-0 flex-1 flex-col gap-8 p-16 font-mono text-caption-10 uppercase",children:[i,s,o]}),c[7]=i,c[8]=s,c[9]=o,c[10]=a):a=c[10],c[11]!==m||c[12]!==p||c[13]!==a||c[14]!==d||c[15]!==u?(l=(0,t.jsx)(to,{title:d,variant:u,pendingVariant:p,onSelectVariant:m,children:a}),c[11]=m,c[12]=p,c[13]=a,c[14]=d,c[15]=u,c[16]=l):l=c[16],l}function tl({title:e,data:n,variant:a,pendingVariant:l,onSelectVariant:c,cta:d,terminalHint:u,repo:p}){let m,h,f,g,y,x,b,v,S,w,k=o.useRef(null);null===k.current&&(m=new Set,h=new Map,f=null,(g=(e,t)=>{if("folder"===e.type){e.open&&m.add(t),e.children.forEach(e=>{g(e,`${t}/${e.name}`)});return}h.set(t,e.content),e.active&&null===f&&(f=t)})(n.root,n.root.name),n.footer.forEach(e=>{h.set(e.name,e.content)}),k.current={openPaths:m,activePath:f,contents:h});let _=k.current,T=o.useRef(_.contents),[A,N]=o.useState(n.root),[E,j]=o.useState(_.openPaths),[I,C]=o.useState(_.activePath),[R,P]=o.useState(null);o.useEffect(()=>{let e=!1;return p?.then(t=>{e||P(t[a]??null)}),()=>{e=!0}},[p,a]);let{markStart:L,trackFileOpen:M}=(y=o.useRef(!1),x=o.useRef(0),b=o.useRef(0),v=o.useRef(!1),S=o.useCallback(()=>{y.current||(y.current=!0,x.current=performance.now(),(0,ej.trackRepoExploreStart)())},[]),w=o.useCallback(e=>{S(),b.current+=1,(0,ej.trackRepoFileOpen)(e)},[S]),o.useEffect(()=>{let e=()=>{y.current&&!v.current&&(v.current=!0,(0,ej.trackRepoExploreDwell)(Math.round((performance.now()-x.current)/1e3),b.current))},t=()=>{"hidden"===document.visibilityState&&e()};return document.addEventListener("visibilitychange",t),window.addEventListener("pagehide",e),()=>{document.removeEventListener("visibilitychange",t),window.removeEventListener("pagehide",e),e()}},[]),{markStart:S,trackFileOpen:w}),D=o.useCallback(e=>{E.has(e)||M(e),j(t=>{let n=new Set(t);return n.has(e)?n.delete(e):n.add(e),n})},[E,M]),U=o.useCallback(e=>{C(e),M(e)},[M]),O=o.useCallback(e=>T.current.get(e),[]),$=o.useCallback((e,t)=>{T.current.set(e,t)},[]),B=o.useRef(null),F=o.useMemo(()=>{var e;let t,r;return e=n.footer,t=[],r=(e,n)=>{"folder"===e.type?e.children.forEach(e=>{r(e,`${n}/${e.name}`)}):t.push({name:e.name,path:n})},A.children.forEach(e=>{r(e,`${A.name}/${e.name}`)}),e.forEach(e=>{t.push({name:e.name,path:e.name})}),t},[A,n.footer]),W=o.useMemo(()=>({...n,root:A}),[n,A]),[G,{open:z,close:H}]=(0,r.useDisclosure)(!1),[Y,{toggle:V,open:X}]=(0,r.useDisclosure)(!0),K=o.useRef(!0),[q,Q]=o.useState(!0),[J,Z]=o.useState(null),ee=o.useCallback(()=>{L(),K.current=!Y,V()},[L,Y,V]),et=o.useCallback(()=>{L(),z()},[L,z]),en=o.useCallback(()=>{L(),Y||(K.current=!0,X()),Z("git")},[L,Y,X]),ei=o.useCallback(()=>Z(null),[]);o.useEffect(()=>{Q(/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent))},[]);let es=o.useCallback(e=>{let t=e.split("/");j(e=>{let n=new Set(e);for(let e=1;e<t.length;e++)n.add(t.slice(0,e).join("/"));return n}),C(e),M(e),H()},[H,M]),eo=o.useCallback((e,t)=>{for(let t of e)T.current.set(t.path,t.content);let n=e.filter(e=>"add"===e.kind);if(n.length>0&&N(e=>{let t=e;for(let e of n)t=function e(t,n,r){let[i,...s]=n;if(void 0===i)return t;if(0===s.length){let e={type:"file",name:i,content:r},n=t.children.some(e=>"file"===e.type&&e.name===i)?t.children.map(t=>"file"===t.type&&t.name===i?e:t):[...t.children,e];return{...t,children:n}}let o=t.children.find(e=>"folder"===e.type&&e.name===i),a=e(o??{type:"folder",name:i,open:!0,children:[]},s,r),l=o?t.children.map(e=>"folder"===e.type&&e.name===i?a:e):[...t.children,a];return{...t,children:l}}(t,e.path.split("/").slice(1),e.content);return t}),!t)return;let r=t.split("/");j(e=>{let t=new Set(e);for(let e=1;e<r.length;e++)t.add(r.slice(0,e).join("/"));return t}),C(t)},[]),el=o.useCallback(e=>{if(!(e.metaKey||e.ctrlKey)||!B.current?.contains(document.activeElement))return;let t=e.key.toLowerCase();"k"===t?(e.preventDefault(),et()):"j"===t&&(e.preventDefault(),ee())},[et,ee]);(0,i.useWindowEvent)("keydown",el);let ec=o.useRef(null),ed=o.useRef(null),[eu,eh]=o.useState(null),[ef,eg]=o.useState(240),[ey,ex]=o.useState(200),eb=o.useCallback((e,t,n)=>{let r=ec.current;if(!r)return;let i=r.getBoundingClientRect();("x"===e||"xy"===e)&&eg(Math.max(150,Math.min(t-i.left,.6*i.width))),("y"===e||"xy"===e)&&ex(Math.max(90,Math.min(i.bottom-n,.7*i.height)))},[]),ev=e=>t=>{t.preventDefault(),ed.current=e,eh(e),t.currentTarget.setPointerCapture(t.pointerId)},eS=e=>{ed.current&&eb(ed.current,e.clientX,e.clientY)},ew=e=>{ed.current=null,eh(null),e.currentTarget.releasePointerCapture(e.pointerId)},ek=e=>t=>{let n=ec.current;if(!n)return;let r=n.getBoundingClientRect();if("y"!==e&&("ArrowLeft"===t.key||"ArrowRight"===t.key)){t.preventDefault();let e="ArrowRight"===t.key?16:-16;eg(t=>Math.max(150,Math.min(t+e,.6*r.width)))}if("x"!==e&&("ArrowUp"===t.key||"ArrowDown"===t.key)){t.preventDefault();let e="ArrowUp"===t.key?16:-16;ex(t=>Math.max(90,Math.min(t+e,.7*r.height)))}},e_=I?I.split("/").pop()??I:null,eT="x"===eu||"xy"===eu,eA="y"===eu||"xy"===eu,eN=(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)("button",{type:"button","aria-label":Y?"Hide terminal":"Show terminal","aria-pressed":Y,onClick:ee,className:(0,ea.cx)("flex cursor-pointer items-center gap-6 rounded-4 px-6 py-4 transition-colors hover:bg-white/10 hover:text-white",Y?"bg-white/10 text-white/80":"text-white/40"),children:[(0,t.jsx)(em,{className:"size-14"}),(0,t.jsxs)("kbd",{className:"hidden rounded-4 border border-white/15 px-5 py-1 font-mono text-[11px] text-white/55 leading-none sm:inline-block",children:[q?"⌘":"Ctrl"," J"]})]}),(0,t.jsxs)("button",{type:"button","aria-label":"Search files",onClick:et,className:"flex cursor-pointer items-center gap-6 rounded-4 px-6 py-4 text-white/40 transition-colors hover:bg-white/10 hover:text-white",children:[(0,t.jsx)(ep,{className:"size-14"}),(0,t.jsxs)("kbd",{className:"hidden rounded-4 border border-white/15 px-5 py-1 font-mono text-[11px] text-white/55 leading-none sm:inline-block",children:[q?"⌘":"Ctrl"," K"]})]})]});return(0,t.jsxs)(to,{ref:B,title:e??n.root.name,variant:a,pendingVariant:l,onSelectVariant:c,actions:eN,className:(0,ea.cx)(eu&&"select-none","x"===eu?"cursor-col-resize":"y"===eu?"cursor-row-resize":"xy"===eu?"cursor-nesw-resize":void 0),children:[(0,t.jsxs)("div",{ref:ec,className:"relative flex min-h-0 flex-1",children:[(0,t.jsx)("aside",{style:{width:ef,maxWidth:"60%"},className:"flex shrink-0 flex-col",children:(0,t.jsx)(eL,{root:A,footer:n.footer,cta:d,openPaths:E,activePath:I,onToggle:D,onOpenFile:U})}),(0,t.jsx)("button",{type:"button","aria-label":"Resize file explorer",onPointerDown:ev("x"),onPointerMove:eS,onPointerUp:ew,onKeyDown:ek("x"),className:"group relative w-3 shrink-0 cursor-col-resize touch-none outline-none",children:(0,t.jsx)("span",{className:(0,ea.cx)("pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors",eT?"bg-white/40":"bg-white/10 group-hover:bg-white/30")})}),(0,t.jsxs)("div",{className:"flex min-w-0 flex-1 flex-col",children:[(0,t.jsx)(er,{path:I,name:e_,initialValue:I?O(I)??"":"",onChange:$},I??"none"),Y?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)("button",{type:"button","aria-label":"Resize terminal",onPointerDown:ev("y"),onPointerMove:eS,onPointerUp:ew,onKeyDown:ek("y"),className:"group relative h-3 shrink-0 cursor-row-resize touch-none outline-none",children:(0,t.jsx)("span",{className:(0,ea.cx)("pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 transition-colors",eA?"bg-white/40":"bg-white/10 group-hover:bg-white/30")})}),(0,t.jsx)("div",{style:{height:ey,maxHeight:"70%"},className:"flex min-h-0 shrink-0 flex-col",children:(0,t.jsx)(te,{data:W,cta:d,hint:u,repo:R,pendingCommand:J,onCommandConsumed:ei,readFile:O,onOpenFile:U,onGenerate:eo,autoFocus:K.current})})]}):null]}),Y?(0,t.jsx)("button",{type:"button","aria-label":"Resize file explorer and terminal",onPointerDown:ev("xy"),onPointerMove:eS,onPointerUp:ew,tabIndex:-1,style:{left:ef,bottom:ey},className:"absolute z-2 size-5 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize touch-none outline-none"}):null]}),(0,t.jsx)(o.Suspense,{fallback:(0,t.jsx)(tn,{}),children:(0,t.jsx)(tt,{repo:p,variant:a,onShowActivity:en})}),(0,t.jsx)(s.AnimatePresence,{children:G?(0,t.jsx)(e$,{files:F,onOpenFile:es,onClose:H},"search"):null})]})}e.s(["IDE",0,function(e){let r,i,s,l,c,d=(0,n.c)(19),{title:u,cta:p,terminalHint:m,repo:h,className:f}=e,[g,y]=o.useState(Y),[x,b]=o.useState(z),[v,S]=o.useState(null),w=o.useRef(Y);d[0]!==g?(r=e=>{if(e!==w.current){if(w.current=e,V(e)){S(null),y(e);return}S(e),X(e).then(t=>{w.current===e&&(b(t),y(e),S(null))}).catch(()=>{w.current=g,S(null)})}},d[0]=g,d[1]=r):r=d[1];let k=r;d[2]!==v||d[3]!==k||d[4]!==g?(i={variant:g,pendingVariant:v,onSelectVariant:k},d[2]=v,d[3]=k,d[4]=g,d[5]=i):i=d[5];let _=i;return d[6]!==f?(s=(0,ea.cx)("h-full w-full",f),d[6]=f,d[7]=s):s=d[7],d[8]!==p||d[9]!==x||d[10]!==h||d[11]!==_||d[12]!==m||d[13]!==u||d[14]!==g?(l=(0,t.jsx)(a.DitherFrame,{className:"h-full",children:V(g)?(0,t.jsx)(ta,{title:u,..._}):(0,t.jsx)(tl,{title:u,data:x,cta:p,terminalHint:m,repo:h,..._},g)}),d[8]=p,d[9]=x,d[10]=h,d[11]=_,d[12]=m,d[13]=u,d[14]=g,d[15]=l):l=d[15],d[16]!==s||d[17]!==l?(c=(0,t.jsx)("div",{className:s,children:l}),d[16]=s,d[17]=l,d[18]=c):c=d[18],c}],138313)},764307,function(e){e.n(e.i(138313))}]);