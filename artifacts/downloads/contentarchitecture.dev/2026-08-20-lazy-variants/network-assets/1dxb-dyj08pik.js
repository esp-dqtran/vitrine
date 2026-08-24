(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,490868,e=>{"use strict";var t=e.i(778213);let n=`---
import JsonLd from "@components/JsonLd.astro";
import Web from "@layouts/Web.astro";
import PageSections from "../features/page-builder/PageSections.astro";
import SiteShell from "../features/site/SiteShell.astro";
import { breadcrumbLd, jsonLdGraph, webPageLd } from "../features/site/seo/structured-data";
import { CACHE_TTL, docCacheTags, SITE_WIDE_CACHE_TAGS } from "../lib/cache";
import { PUBLIC_SITE_URL } from "../lib/env";
import { getDraftModeProps } from "../sanity/lib/draft-mode";
import { loadQuery } from "../sanity/lib/load-query";
import { PageQ } from "../sanity/queries";
import { seo } from "../sanity/seo";

// Every \`page\` document with a uri renders here, homepage included. Rendered on
// demand so the Presentation tool's draft cookie applies to the very same route.
const uri = Astro.params.uri ? \`/\${Astro.params.uri}\` : "/";

const { data: page } = await loadQuery<PageQResult>({ query: PageQ, params: { uri }, ...getDraftModeProps(Astro) });

if (!page) {
  // A null body is what makes Astro render 404.astro, and the status stays 404.
  return new Response(null, { status: 404 });
}

// Cacheable with tags: the page's own identity plus "site", because the header,
// footer, and SEO defaults render here too. Publishing Site busts every page.
Astro.cache.set({ ...CACHE_TTL, tags: [...docCacheTags(page), ...SITE_WIDE_CACHE_TAGS] });

const canonical = uri === "/" ? \`\${PUBLIC_SITE_URL}/\` : \`\${PUBLIC_SITE_URL}\${uri}\`;

// Per-page metadata, falling back to the Site singleton's defaults.
const seoProps = await seo(Astro, { ...page.seoMetadata, canonical });

// One @graph per page: its own WebPage identity plus a breadcrumb trail, both
// pointing back at the site-level nodes Web.astro emits.
const pageJsonLd = jsonLdGraph([
  webPageLd({ name: seoProps.title, url: canonical, description: seoProps.description, siteUrl: PUBLIC_SITE_URL }),
  ...(uri === "/"
    ? []
    : [breadcrumbLd([{ name: "Home", url: \`\${PUBLIC_SITE_URL}/\` }, { name: page.title, url: canonical }])]),
]);
---

<Web {...seoProps}>
  <JsonLd data={pageJsonLd} />
  <SiteShell showHeader={page.showHeader} showFooter={page.showFooter}>
    <PageSections docId={page._id} />
  </SiteShell>
</Web>
`,s=`---
import { getDraftModeProps } from "../../sanity/lib/draft-mode";
import { loadQuery } from "../../sanity/lib/load-query";
import { PageSectionsQ } from "./queries";
import ContactFormSection from "./sections/ContactFormSection/ContactFormSection.astro";
import CtaSection from "./sections/CtaSection.astro";
import MediaSection from "./sections/MediaSection.astro";
import TextSection from "./sections/TextSection.astro";
// PLOP: Add Import

// The one registry. The editor reorders sections in Sanity; this maps each
// _type to its component. The plop generator adds new entries at the markers.

const { docId } = Astro.props;

const sections = {
  mediaSectionField: MediaSection,
  ctaSectionField: CtaSection,
  textSectionField: TextSection,
  contactFormSectionField: ContactFormSection,
  // PLOP: Add Export
} as const;

const { data } = await loadQuery<PageSectionsQResult>({
  query: PageSectionsQ,
  params: { docId },
  ...getDraftModeProps(Astro),
});
---

{
  // isFirst marks the LCP candidate, so the top section can opt into a
  // priority hint on its image instead of lazy-loading it.
  data?.map((section, index) => {
    const Component = sections[section._type as keyof typeof sections];
    return Component ? <Component docId={docId} sectionKey={section._key} isFirst={index === 0} /> : null;
  })
}
`,a=`---
import { stegaClean } from "@sanity/client/stega";
import { getDraftModeProps } from "../../../sanity/lib/draft-mode";
import { loadQuery } from "../../../sanity/lib/load-query";
import SanityRichText from "../../../sanity/rich-text/SanityRichText.astro";
import { TextSectionQ } from "../queries";

// A section fetches its own slice of the document, by docId + sectionKey. Add a
// field in the Studio, extend one query, render it here. No page-level plumbing.

const { docId, sectionKey } = Astro.props;

const { data: section } = await loadQuery<TextSectionQResult>({
  query: TextSectionQ,
  params: { docId, sectionKey },
  ...getDraftModeProps(Astro),
});
---

{
  section?.content && (
    <div id={stegaClean(section.settings?.hash) ?? undefined} data-page-builder-section="textSection">
      {section.content.headline && <h1 class="mb-24 text-balance text-headline-10">{section.content.headline}</h1>}
      <SanityRichText animated value={section.content.text} class="text-body-10" />
    </div>
  )
}
`,o=`import { defineQuery } from "groq";
import { RichTextFragment } from "~/features/rich-text/fragment";
import { LinkFragment } from "~/features/sanity/link/fragment";
import { MediaFragment } from "~/features/sanity/media/fragment";

// Every section self-fetches its own slice by docId + sectionKey (see the section
// components). Fragments are shared, so a link or a media field is queried the
// same way everywhere and typegen keeps the result types honest.

// Sections parked with the Disabled toggle never leave GROQ.
export const PageSectionsQ = defineQuery(\`*[_id == $docId][0].pageBuilder.sectionsArray[sectionSettings.disabled != true]{
  _key,
  _type
}\`);

export const TextSectionQ =
  defineQuery(\`*[_id == $docId][0].pageBuilder.sectionsArray[_type == "textSectionField" && _key == $sectionKey][0]{
    "content": sectionContent{
      headline,
      "text": appRichText[]{\${RichTextFragment}}
    },
    "settings": sectionSettings{
      "hash": coalesce(sectionHash.current, _key),
    },
}\`);

// PLOP: Add Section Query
`,i=`import { defineQuery } from "groq";
import { SeoMetadataFragment } from "~/features/site/seo/fragment";
import { SANITY_BLOG_INDEX_URI, SANITY_SINGLETON_BLOG_ID } from "~/sanity/constants";

// Route-level queries for the pages model. Fragments live beside their features
// (src/features/**/fragment.ts); section queries live in features/page-builder/queries.ts.

export const PageQ = defineQuery(\`
  *[_type == "page" && uri.current == $uri][0]{
    title,
    "uri": uri.current,
    seoMetadata{\${SeoMetadataFragment}},
  }
\`);

// The blog index is a singleton, so it is fetched by id rather than by URI like the
// catch-all route. Its uri field is read only and exists so the sitemap, llms.txt, and
// agent Markdown keep treating every routed document the same way.
export const BlogPageQ = defineQuery(\`
  *[_id == "\${SANITY_SINGLETON_BLOG_ID}"][0]{
    title,
    heading,
    "uri": coalesce(uri.current, "\${SANITY_BLOG_INDEX_URI}"),
    seoMetadata{\${SeoMetadataFragment}},
  }
\`);

// PLOP: Add Route Query
`,r=`import type { ClientPerspective, QueryParams } from "@sanity/client";
import { SANITY_API_VIEW_TOKEN } from "../../lib/env";
import { sanityClient } from "./client";

// All page content fetches go through here. Draft mode (the Presentation tool) reads
// the "drafts" perspective with stega encoding for the overlays; stega is requested
// per call, so it can never leak into published HTML.

export async function loadQuery<QueryResponse>({
  query,
  params,
  perspectiveCookie,
}: {
  query: string;
  params?: QueryParams;
  perspectiveCookie?: string | undefined;
}): Promise<{ data: QueryResponse; perspective: ClientPerspective }> {
  const draftMode = Boolean(perspectiveCookie);
  const perspective: ClientPerspective = draftMode ? (parsePerspective(perspectiveCookie) ?? "drafts") : "published";

  // Token applied per request. Draft reads always hit the live API: editors must
  // never see CDN-stale drafts (dev uses the CDN otherwise).
  let client = SANITY_API_VIEW_TOKEN ? sanityClient.withConfig({ token: SANITY_API_VIEW_TOKEN }) : sanityClient;

  if (draftMode) {
    client = client.withConfig({ useCdn: false });
  }

  const data = await client.fetch<QueryResponse>(query, params ?? {}, { perspective, stega: draftMode });

  return { data, perspective };
}
`,d=`import { SANITY_SINGLETON_SITE_ID, SANITY_SINGLETON_SITE_SETTINGS_ID } from "~/sanity/constants";

// The cache tag model, shared by the pages that set tags and the /api/revalidate
// webhook that invalidates them: the document _type, a doc:<id> tag, and the routed
// uri. Every page also carries both site-wide singletons' tags: Site owns the header,
// footer, and SEO defaults, Settings owns the favicon, and all of them render on
// every page.

export const CACHE_TTL = { maxAge: 31536000 } as const;

export const SITE_WIDE_CACHE_TAGS = [SANITY_SINGLETON_SITE_ID, SANITY_SINGLETON_SITE_SETTINGS_ID];

/** Stable per-document tag; draft ids collapse onto their published id. */
export function docTag(id: string): string {
  return \`doc:\${id.replace(/^drafts\\./, "")}\`;
}

/** The tags a routed document's response carries, and the ones a publish invalidates. */
export function docCacheTags({ _id, _type, uri }: { _id: string; _type: string; uri?: string | null }): string[] {
  const tags = [_type, docTag(_id)];

  if (uri) {
    tags.push(uri);
  }

  return tags;
}
`,l=`// Re-exports from astro:env, so importing this from client code is a build error:
// secrets can never end up in the browser bundle. The schema (types, defaults, and
// which vars are secret) lives in astro.config.mjs and is validated at build start.

export {
  PUBLIC_SANITY_API_VERSION,
  PUBLIC_SANITY_DATASET,
  PUBLIC_SANITY_PROJECT_ID,
  PUBLIC_SANITY_STUDIO_BASE_PATH,
  PUBLIC_SITE_URL,
  PUBLIC_UMAMI_WEBSITE_ID,
} from "astro:env/client";

export {
  BASIC_AUTH_PASSWORD,
  BASIC_AUTH_USERNAME,
  RESEND_API_KEY,
  RESEND_EMAIL_FROM,
  SANITY_API_EDIT_TOKEN,
  SANITY_API_VIEW_TOKEN,
  SANITY_REVALIDATE_SECRET,
} from "astro:env/server";
`,c=`import { sequence } from "astro:middleware";
import { perspectiveCookieName } from "@sanity/preview-url-secret/constants";
import type { MiddlewareHandler } from "astro";
import { IS_DEV } from "~/features/utils/constants";

// One middleware, three jobs on every page request:
//   1. Baseline security headers on the way out.
//   2. Agent content negotiation: a request that prefers Markdown (Accept:
//      text/markdown) is rewritten to the Markdown route, so agents get a
//      token-light page on the same URL. See docs/features/agent-markdown.md.
//   3. HTTP Basic Auth: gate the whole site or individual URLs with the
//      BASIC_AUTH_* env vars, toggled from the CMS. See docs/features/basic-auth.md.
// Eligibility for both is read from the CMS (cached, busted by the publish webhook).

const runtimeGates: MiddlewareHandler = async (context, next) => {
  // A Studio preview session is already authenticated: skip the gate, and keep
  // draft responses out of the route cache.
  if (context.cookies.has(perspectiveCookieName)) {
    context.cache.set(false);
    return next();
  }

  // The gate is a deploy-time concern: local development is never asked for a
  // password. IS_DEV is statically false in a build, so deployments still gate.
  if (IS_DEV) {
    return next();
  }

  return next();
};

export const onRequest = sequence(securityHeaders, runtimeGates);
`,m=`// Hold an element's module (and heavy deps like GSAP) out of the initial page load
// until its host nears the viewport. The markup ships in the HTML; the JavaScript is
// a separate chunk. Loaded a little early, so it is never a tap that waits.

const ROOT_MARGIN = "256px";

export function lazyCustomElement(hostSelector: string, load: () => Promise<unknown>) {
  let loaded = false;

  const observer = new IntersectionObserver(
    (entries) => {
      if (loaded || !entries.some((entry) => entry.isIntersecting)) {
        return;
      }

      loaded = true;
      observer.disconnect();
      // The module defines the element itself; every instance on the page upgrades in place.
      void load();
    },
    { rootMargin: ROOT_MARGIN }
  );

  const wire = () => document.querySelectorAll(hostSelector).forEach((host) => observer.observe(host));

  wire();
  // View transitions swap the DOM, so the new hosts have to be observed again.
  document.addEventListener("astro:page-load", wire);
}
`,p=`// Client behavior is a custom element, not a framework component: the markup comes
// from the .astro file, this file is the only JavaScript, and the .astro <script>
// does nothing but import it. React lives in the Studio and nowhere else.

export class AnimatedTextElement extends HTMLElement {
  connectedCallback() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    this.#animate();
  }

  #animate() {
    // Split into lines, mask each one, reveal on scroll with GSAP.
  }
}
`,u=`import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import sanity from "@sanity/astro";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  site: PUBLIC_SITE_URL,
  // Always SSR: pages render on demand (so draft mode can read the Presentation
  // cookie), the Studio is embedded at /studio, and /api/* + middleware are live.
  output: "server",
  adapter: vercel(),
  // Tag-based route caching. Pages declare maxAge/tags via Astro.cache and the
  // /api/revalidate webhook invalidates by tag on publish. The provider picks the
  // storage: Vercel's CDN in production, an in-memory LRU in dev; call sites don't change.
  cache: {
    provider: { name: "cache-with-bypass", entrypoint: new URL("./src/lib/cache-provider.ts", import.meta.url) },
  },
  // CMS-managed redirects, fetched once at config load and baked into the build.
  redirects: await fetchRedirects(),
  // One validated source of truth for env. Public vars are readable from
  // astro:env/client; importing a secret in client code is a build error.
  env: {
    schema: {
      PUBLIC_SITE_URL: envField.string({ context: "client", access: "public" }),
      PUBLIC_SANITY_PROJECT_ID: envField.string({ context: "client", access: "public" }),
      PUBLIC_SANITY_DATASET: envField.string({ context: "client", access: "public" }),
      SANITY_API_VIEW_TOKEN: envField.string({ context: "server", access: "secret", min: 1 }),
      SANITY_API_EDIT_TOKEN: envField.string({ context: "server", access: "secret", min: 1 }),
      SANITY_REVALIDATE_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
    },
    // Validate required secrets at build/dev start, not at first request.
    validateSecrets: true,
  },
  integrations: [
    // Provides sanity:client for page fetches; embeds the Studio at /studio.
    sanity({ projectId, dataset, apiVersion, studioBasePath, stega: { studioUrl: studioBasePath } }),
    react(), // renderer for the embedded Sanity Studio, never for public pages
  ],
  vite: { plugins: [tailwindcss()] },
});
`,h=`{
  "name": "the-content-architecture-astro",
  "version": "0.0.0",
  "private": true,
  "engines": { "node": "^24.15.0", "npm": ">=11.6.2" },
  "volta": { "node": "24.15.0" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "start": "vercel dev",
    "check": "concurrently npm:check.*",
    "check.types": "astro check",
    "check.biome": "biome lint --diagnostic-level=error",
    "format": "biome check --write --unsafe",
    "plop": "plop",
    "clear": "rm -rf .astro node_modules/.vite dist .vercel/output",
    "sanity:typegen": "sanity schema extract --force --path='sanity-schema.json' && sanity typegen generate",
    "sanity:schema-deploy": "dotenvx run -- sanity schema deploy",
    "sanity:project-setup": "dotenvx run -- node --import=tsx scripts/sanity-project-setup/setup.ts"
  },
  "dependencies": {
    "astro": "7.1.6",
    "@astrojs/react": "6.0.2",
    "@astrojs/vercel": "11.0.4",
    "@sanity/astro": "3.5.0",
    "@sanity/client": "7.26.1",
    "sanity": "6.9.0",
    "astro-portabletext": "0.13.0",
    "gsap": "3.15.0",
    "lenis": "1.3.26",
    "@mux/mux-player": "3.13.2",
    "resend": "6.18.1",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.7",
    "@astrojs/check": "0.9.10",
    "tailwindcss": "4.3.3",
    "typescript": "6.0.3",
    "plop": "4.0.5",
    "concurrently": "10.0.4",
    "lefthook": "2.1.10"
  }
}
`,f=`{
  "name": "the-content-architecture-astro",
  "version": "0.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "the-content-architecture-astro",
      "version": "0.0.0"
    }
  }
}
`,y=`{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "paths": {
      "@components/*": ["./src/components/*"],
      "@layouts/*": ["./src/layouts/*"],
      // The root Studio folder, listed first so ~/sanity/* never resolves into src/sanity/*.
      "~/sanity/*": ["./sanity/*"],
      "~/*": ["./src/*"]
    }
  }
}
`,g=`# Canonical site origin (protocol, no trailing slash).
PUBLIC_SITE_URL=http://localhost:4321

# Sanity project (public; \`npm run sanity:project-setup\` fills these).
PUBLIC_SANITY_PROJECT_ID=your-project-id
PUBLIC_SANITY_DATASET=production
PUBLIC_SANITY_API_VERSION=2025-02-19

# Public route the embedded Studio mounts at (must start with "/", no trailing slash).
PUBLIC_SANITY_STUDIO_BASE_PATH=/studio

# Server-only Sanity tokens (never reach the browser); \`npm run sanity:project-setup\` creates both.
SANITY_API_VIEW_TOKEN=
SANITY_API_EDIT_TOKEN=

# Optional: shared secret for the Sanity publish webhook (/api/revalidate). Leave unset to skip the webhook.
SANITY_REVALIDATE_SECRET=

# Optional: HTTP Basic Auth; the toggles live in Sanity.
BASIC_AUTH_USERNAME=
BASIC_AUTH_PASSWORD=

# Resend, for contact form notification emails. Optional in dev; required for the feature in production.
RESEND_API_KEY=
RESEND_EMAIL_FROM=

# Umami analytics website id; tracking is disabled when unset.
PUBLIC_UMAMI_WEBSITE_ID=
`,b=`node_modules
dist
.astro
.vercel
.env
.env*.local
*.log
.DS_Store
`,S=`{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--isolated"]
    },
    "Astro Docs": {
      "type": "http",
      "url": "https://mcp.docs.astro.build/mcp"
    }
  }
}
`,v=`engine-strict=true
`,T=`24.15.0
`,x=`{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "files": {
    "includes": ["**/*.{ts,tsx,astro,css,json,jsonc,md}", "!**/sanity/types.ts", "!.astro", "!**/templates"]
  },
  "formatter": { "lineWidth": 130 },
  "linter": { "enabled": true }
}
`,k=`# Pins the hooks to the .nvmrc Node before anything runs.
rc: .lefthookrc

pre-commit:
  parallel: true
  commands:
    lint-staged:
      run: npx @biomejs/biome check --write {staged_files}
      stage_fixed: true
    typecheck:
      glob: "*.{ts,tsx,astro}"
      run: npx astro check
`,A=`# Sourced by lefthook before every hook command. Git GUIs run hooks in a shell
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
`,I=`import { defineCliConfig } from "sanity/cli";
import { sanityConfig } from "./sanity/config";

export default defineCliConfig({
  api: { projectId: sanityConfig.projectId, dataset: sanityConfig.dataset },
  typegen: {
    // Page .astro files excluded: frontmatter's top-level return trips typegen's
    // parser, and no queries are defined there.
    path: ["./src/**/*.{ts,tsx,astro}", "!./src/pages/**/*.astro", "./sanity/**/*.{ts,tsx}", "./sanity.config.ts"],
    schema: "./sanity-schema.json",
    generates: "./sanity/types.ts",
  },
});
`,w=`import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { presentationTool } from "sanity/presentation";
import { media } from "sanity-plugin-media";
import { muxInput } from "sanity-plugin-mux-input";
import { autoAltTextPlugin } from "./sanity/auto-alt-text";
import { sanityConfig } from "./sanity/config";
import { buildStructure } from "./sanity/structure";
import { schemaTypes } from "./sanity/schemas";

// The same Studio as the Next.js edition: sanity/ is a standalone folder, and
// sanity/config.ts is the one seam that knows which app it is mounted in.

export default defineConfig({
  name: "default",
  title: "The Content Architecture",
  projectId: sanityConfig.projectId,
  dataset: sanityConfig.dataset,
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
`,_=`// Configuration seam for the Sanity folder: the single place the schema, structure,
// actions, and inputs read runtime config. Self-contained on purpose, so the folder
// can be lifted into another project (Astro, Next.js, plain \`sanity dev\`) by editing
// only this file. Here the values come from Astro's PUBLIC_* vars, with a process.env
// fallback for the Sanity CLI, which evaluates this outside Astro.

export const sanityConfig = {
  projectId: requireConfig("PUBLIC_SANITY_PROJECT_ID"),
  dataset: requireConfig("PUBLIC_SANITY_DATASET"),
  appUrl: requireConfig("PUBLIC_SITE_URL"),
  apiVersion: readEnv("PUBLIC_SANITY_API_VERSION") ?? "2025-02-19",
  studioBasePath: readEnv("PUBLIC_SANITY_STUDIO_BASE_PATH") ?? "/studio",
  endpoints: {
    draftModeEnable: "/api/draft-mode/enable",
    draftModeDisable: "/api/draft-mode/disable",
    seoScreenshot: "/api/seo-screenshot",
    generateLlmsTxt: "/api/agents/llms-txt",
    generatePageMarkdown: "/api/agents/page-markdown",
    imageAltText: "/api/agents/image-alt-text",
  },
};
`,C=`{
  "_": "Generated by sanity typegen. Do not edit by hand.",
  "documents": ["page", "blog", "article", "articleCategory", "site", "redirect", "contactFormSubmission"],
  "sections": ["mediaSection", "ctaSection", "textSection", "contactFormSection"]
}
`,E=`import { exec } from "node:child_process";

// Run \`npm run plop\`, pick a generator, name it. Schema, component, query, types,
// and registration are wired across every file. Then typegen and format run for you.

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
        path: "src/features/page-builder/sections/{{pascalCase name}}.astro",
        templateFile: "templates/page-builder-section/component.astro.hbs",
      },
      {
        type: "modify",
        path: "src/features/page-builder/queries.ts",
        pattern: "// PLOP: Add Section Query",
      },
      {
        type: "modify",
        path: "src/features/page-builder/PageSections.astro",
        pattern: "// PLOP: Add Import",
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
`,P=`# THE CONTENT ARCHITECTURE / AGENTS (ASTRO)

The orchestration layer for agentic tools. Ask an agent to build this from
scratch and you get a different architecture every run, all plausible, none
decided. Here the decisions are made: Claude Code, Cursor, or any agent reads
this first and ingests the conventions instead of inventing them. No drift.

## SKILLS
  astro                   pages, layouts, routing, SEO, draft mode
  sanity                  schema, GROQ, Studio, typegen, loadQuery
  custom-elements         all client behavior; no React on public pages
  icons                   one registry, one module that imports SVGs
  lazy-hydration          defer element JS until it is needed
  tailwind                v4 tokens, Tailwind-first, isolate
  mobile-first            base = phone, wider-only prefixes, no max-*
  server                  API endpoints in src/pages/api
  scaffolding-plop        generators for routes, sections, blocks
  section-colocation      where a section's files live as it grows
  gsap-core               tweens, timelines, ScrollTrigger, performance
  design-engineering      motion, easing, micro-interactions
  modern-web-guidance     platform patterns: a11y, perf, forms, CSS
  performance-audit       Lighthouse/CWV audit playbook
  seo-aeo-best-practices  metadata, sitemaps, JSON-LD, EEAT
  agent-markdown          Markdown for agents via content negotiation
  code-style              TypeScript conventions, breathing control flow
  comments                comments are rare and explain WHY
  umami-analytics         SSR-safe event instrumentation
  dev-server              reuse the running server; local is never gated
  docs-maintenance        keep docs aligned with code
  codebase-design         deep modules, interfaces, seams
  domain-modeling         glossary + decisions as ADRs

## WORKFLOW
  1. Scope first: the smallest set of files to change.
  2. Reuse existing sections and field factories before adding new ones.
  3. Run "npm run sanity:typegen" after any schema change.
  4. Source of truth is the code, not the docs.
`,R=`# The Content Architecture (Astro)

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
`,L=`@AGENTS.md
`,N=`# License

**The Content Architecture, Astro edition**

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
`,O=[{id:"Page Builder Section",description:"Create a new page builder section",prompts:[{name:"name",message:"Name (section names will automatically be suffixed with 'Section'. eg. 'cta' -> 'ctaSection')",filter:e=>`${e} Section`}],actions:[{type:"add",path:"./sanity/schemas/page-sections/{{kebabCase name}}.tsx",template:"// Schema for the {{titleCase (removeSectionSuffix name)}} section.\n"},{type:"modify",path:"./sanity/schemas/page-sections/index.ts",pattern:/(\/\/ PLOP: Add Import)/g,template:'import { {{camelCase name}} } from "./{{kebabCase name}}";\n$1'},{type:"modify",path:"./sanity/schemas/page-sections/index.ts",pattern:/(\/\/ PLOP: Add Export)/g,template:"{{camelCase name}},\n  $1"},{type:"add",path:"src/features/page-builder/sections/{{pascalCase name}}.astro",template:"---\n// {{titleCase (removeSectionSuffix name)}} section.\n---\n"},{type:"modify",path:"src/features/page-builder/queries.ts",pattern:/(\/\/ PLOP: Add Section Query)/g,template:`// {{titleCase (removeSectionSuffix name)}} section query.
$1`},{type:"modify",path:"src/features/page-builder/PageSections.astro",pattern:/(\/\/ PLOP: Add Import)/g,template:"import {{pascalCase name}} from './sections/{{pascalCase name}}.astro';\n$1"},{type:"modify",path:"src/features/page-builder/PageSections.astro",pattern:/(\/\/ PLOP: Add Export)/g,template:"{{camelCase name}}Field: {{pascalCase name}},\n  $1"},{type:"run",description:"Generate types"},{type:"run",description:"Format code"}]}],M={root:{type:"folder",name:"the-content-architecture-astro",open:!0,children:[{type:"folder",name:".agents",children:[{type:"folder",name:"skills",children:[(0,t.skill)("astro","Pages, layouts, routing, SEO/meta, and page-level draft mode."),(0,t.skill)("sanity","Schema, GROQ, Studio, typegen, loadQuery, media and rich text renderers."),(0,t.skill)("custom-elements","The vanilla-TS custom element pattern for all client behavior."),(0,t.skill)("icons","The src/components/Icon registry: the only module allowed to import an SVG."),(0,t.skill)("lazy-hydration","Defer heavy element JS via lazyCustomElement (src/lib/lazy-hydrate.ts)."),(0,t.skill)("tailwind","Tailwind v4 @theme tokens, Tailwind-first, isolate, class extraction."),(0,t.skill)("mobile-first","Base utilities describe the phone; wider-only prefixes, no max-* variants."),(0,t.skill)("server","Astro API endpoints in src/pages/api."),(0,t.skill)("scaffolding-plop","Generator-first routes, page builder sections, rich text blocks."),(0,t.skill)("section-colocation","Where a page-builder section's files live once it outgrows one file."),(0,t.skill)("gsap-core","Tweens, timelines, and the GSAP setup used for scroll animation."),(0,t.skill)("gsap-scrolltrigger","ScrollTrigger patterns: pinning, scrubbing, cleanup."),(0,t.skill)("gsap-timeline","Sequencing, labels, and nested timelines."),(0,t.skill)("gsap-plugins","SplitText, Flip, Observer, and the rest of the plugin surface."),(0,t.skill)("gsap-performance","Keeping animation on the compositor and off the main thread."),(0,t.skill)("gsap-utils","gsap.utils helpers: mapRange, snap, interpolate, quickSetter."),(0,t.skill)("design-engineering","Motion, easing, micro-interactions, perceived performance."),(0,t.skill)("modern-web-guidance","Framework-agnostic platform patterns: accessibility, performance, forms, CSS."),(0,t.skill)("performance-audit","Lighthouse/Core Web Vitals audit playbook: measure, fix, verify."),(0,t.skill)("seo-aeo-best-practices","Metadata, Open Graph, sitemaps, JSON-LD, EEAT, AEO."),(0,t.skill)("agent-markdown","Keep the Markdown served to agents (content negotiation) in sync with sections."),(0,t.skill)("code-style","TypeScript conventions and breathing control flow."),(0,t.skill)("comments","Comment minimalism: comments are rare and explain WHY."),(0,t.skill)("umami-analytics","SSR-safe Umami event instrumentation."),(0,t.skill)("dev-server","Reuse the dev server already running; local is never behind Basic Auth."),(0,t.skill)("docs-maintenance","Keep docs and README aligned with code."),(0,t.skill)("codebase-design","Deep modules: interfaces, seams, adapters, testability."),(0,t.skill)("domain-modeling","Glossary in CONTEXT.md, architectural decisions as ADRs.")]}]},{type:"folder",name:"docs",children:[{type:"file",name:"README.md",content:"# Docs\n\nFeature and Sanity docs hub.\n"},{type:"file",name:"deployment.md",content:"# Deployment\n\nSSR on Vercel: push to deploy. Route caching lives on the CDN with tag-based invalidation.\n"},{type:"folder",name:"features",children:[{type:"file",name:"basic-auth.md",content:"# Basic auth\n\nToggle HTTP Basic Auth site-wide or per-page from the CMS.\n"},{type:"file",name:"agent-markdown.md",content:"# Agent Markdown\n\nPublic pages serve a token-light Markdown version to agents that send `Accept: text/markdown`, on the same URL.\n"},{type:"file",name:"llms-txt.md",content:"# llms.txt\n\nAn editable, AI-generated /llms.txt drafted from your content with Sanity Agent Actions.\n"},{type:"file",name:"animated-content.md",content:"# Animated content\n\nScroll-driven reveals as custom elements, with reduced-motion respected.\n"},{type:"file",name:"mcp-servers.md",content:"# MCP servers\n\nProject-scoped `.mcp.json` servers: chrome-devtools drives a real Chrome for traces and screenshots, and the Astro docs server answers from the current docs.\n"},{type:"file",name:"view-transitions.md",content:"# View transitions\n\nCross-document transitions and navigation timing.\n"},{type:"file",name:"redirects.md",content:"# Redirects\n\nManaged in Sanity, fetched at config load and baked into the build.\n"},{type:"file",name:"code-generation.md",content:"# Code generation\n\nThe plop generators for sections, prefix routes, and rich text blocks.\n"},{type:"file",name:"spam-prevention.md",content:"# Spam prevention\n\nHoneypot plus timing checks on the contact form.\n"},{type:"file",name:"umami-tracking.md",content:"# Umami tracking\n\nSSR-safe event helpers and payload constraints.\n"},{type:"file",name:"contact-form-notifications.md",content:"# Contact form notifications\n\nResend emails on submission, with the submission stored in Sanity.\n"},{type:"file",name:"agent-skills.md",content:"# Agent skills\n\nWhat lives in .agents/skills and how the skills hand off to each other.\n"}]},{type:"folder",name:"sanity",children:[{type:"file",name:"README.md",content:"# Sanity docs\n\nSchema, Studio, fetching, draft mode, datasets.\n"},{type:"file",name:"schema-and-content-model.md",content:"# Schema and content model\n\nDocuments, field factories, page sections, singletons.\n"},{type:"file",name:"fetching-groq-and-types.md",content:"# Fetching, GROQ, and types\n\nloadQuery, fragments, defineQuery, and generated types.\n"},{type:"file",name:"revalidation-and-caching.md",content:"# Revalidation and caching\n\nRoute cache tags and the /api/revalidate publish webhook.\n"},{type:"file",name:"draft-mode-and-visual-editing.md",content:"# Draft mode and Visual Editing\n\nThe Presentation tool, the perspective cookie, and stega overlays.\n"},{type:"file",name:"standalone-folder.md",content:"# Standalone sanity/ folder\n\nRelative imports only, configured through sanity/config.ts.\n"},{type:"file",name:"studio-and-structure.md",content:"# Studio and structure\n\nThe embedded Studio at /studio and the desk structure.\n"},{type:"file",name:"project-setup.md",content:"# Project setup\n\nOne command: project, tokens, CORS, webhook, .env.\n"},{type:"file",name:"seed-dataset.md",content:"# Seed dataset\n\nExample pages, articles, and media to boot a new project.\n"},{type:"file",name:"dataset-migration.md",content:"# Dataset migration\n\nExport, import, and copy one dataset into another.\n"}]}]},{type:"folder",name:"sanity",children:[{type:"folder",name:"schemas",children:[{type:"folder",name:"documents",children:[{type:"file",name:"page.tsx",content:t.PAGE_SCHEMA},(0,t.stub)("blog.tsx","Blog index singleton: same Page / Content / SEO / Agents tabs as a page, no page builder, URI pinned to /blog."),(0,t.stub)("article.tsx","Article document: slugs under /blog, one rich text body instead of a page builder."),(0,t.stub)("article-category.tsx","Article taxonomy term."),(0,t.stub)("site.tsx","Global singleton: the copy that renders on every page (header, footer, SEO defaults, the 404)."),(0,t.stub)("site-settings.tsx","Settings singleton: redirects, Basic Auth, the favicon, the Agents tab (llms.txt, automatic alt text), notification emails."),(0,t.stub)("redirect.tsx","From -> to with a 301/302 status, baked into the build in astro.config.mjs."),(0,t.stub)("contact-form-submission.tsx","API-only, read-only form submissions."),(0,t.stub)("image-alt-text.tsx","Scratch type the alt text agent generates into. Hidden from editors: alt text lands on the image asset.")]},{type:"folder",name:"fields",children:[{type:"file",name:"create-link.tsx",content:t.CREATE_LINK},{type:"file",name:"create-media.tsx",content:t.CREATE_MEDIA},{type:"file",name:"create-page-builder.tsx",content:t.CREATE_PAGE_BUILDER},{type:"file",name:"create-uri-field.tsx",content:t.CREATE_URI_FIELD},{type:"folder",name:"create-rich-text",children:[{type:"file",name:"index.tsx",content:t.CREATE_RICH_TEXT},{type:"folder",name:"blocks",children:[(0,t.stub)("index.ts","Block registry."),(0,t.stub)("media-block.tsx","Media block schema.")]}]},(0,t.stub)("create-agent-markdown-field.tsx","Agents tab field factory: the stored Markdown mirror plus its Generate flow."),(0,t.stub)("create-icon.tsx","Icon picker field."),(0,t.stub)("create-seo-field.tsx","SEO field factory: noIndex, title, description, share image, and the agent-Markdown toggle."),(0,t.stub)("app-color.tsx","Color field."),(0,t.stub)("aspect-ratio.tsx","Aspect ratio field."),(0,t.stub)("video-options.tsx","Video playback options field."),(0,t.stub)("lottie-options.tsx","Lottie playback options field."),(0,t.stub)("rive-options.tsx","Rive playback options field.")]},{type:"folder",name:"page-sections",children:[(0,t.stub)("text-section.tsx","Schema for the text section."),(0,t.stub)("media-section.tsx","Schema for the media section."),(0,t.stub)("cta-section.tsx","Schema for the CTA section."),(0,t.stub)("contact-form-section.tsx","Schema for the contact form section."),{type:"file",name:"index.ts",content:t.PAGE_SECTIONS_SCHEMA_INDEX}]},{type:"file",name:"index.ts",content:"export const schemaTypes = [\n  page,\n  blog,\n  article,\n  articleCategory,\n  site,\n  redirect,\n  contactFormSubmission,\n  // shared objects + ...sections\n];\n"}]},{type:"file",name:"config.ts",content:_},{type:"file",name:"structure.tsx",content:t.STRUCTURE_TSX},{type:"file",name:"constants.ts",content:t.CONSTANTS_TS},(0,t.stub)("utils.ts","Shared factory helpers: visibleIf / requiredIf, selectByName (whitelist/blacklist), composeValidation."),(0,t.stub)("actions.tsx","Custom Studio document actions."),(0,t.stub)("templates.tsx","Initial-value templates for new documents."),(0,t.stub)("auto-alt-text.tsx","Studio plugin: listens for image uploads and has each one described, so alt text is written before anyone forgets."),{type:"folder",name:"inputs",children:[(0,t.stub)("asset-dimensions-input.tsx","Lottie and Rive file inputs that read back asset dimensions."),(0,t.stub)("async-autocomplete.tsx","Async autocomplete input."),(0,t.stub)("clearable-object-input.tsx","Object input with a clear button."),(0,t.stub)("generate-text-input.tsx","Agent Markdown and llms.txt field inputs: textarea plus a Generate-with-Sanity-AI button."),(0,t.stub)("redeploy-input.tsx","Redeploy site button: triggers the deploy hook from the Studio."),(0,t.stub)("alt-text-input.tsx","Automatic alt text panel: the on/off toggle plus a batched backfill for images already in the library."),(0,t.stub)("seo-image-input.tsx","SEO image input with preview.")]},{type:"folder",name:"lib",children:[(0,t.stub)("parse-lottie-dimensions.ts","Read intrinsic dimensions from a Lottie file."),(0,t.stub)("parse-rive-dimensions.ts","Read intrinsic dimensions from a Rive file.")]}]},{type:"folder",name:"scripts",children:[{type:"folder",name:"sanity-dataset",children:[(0,t.stub)("export.ts","Export the dataset to disk."),(0,t.stub)("import.ts","Import a dataset backup or the bundled seed content."),(0,t.stub)("migrate.ts","Copy one dataset into another. production -> staging.")]},{type:"folder",name:"sanity-project-setup",children:[(0,t.stub)("setup.ts","One command bootstrap: project, tokens, CORS, webhook, .env.")]}]},{type:"folder",name:"seed",children:[{type:"file",name:"README.md",content:"# Seed content\n\nExample pages, articles, and media. Import with `npm run sanity:dataset-import`.\n"},(0,t.stub)("seed-dataset.tar.gz","Bundled starter dataset (pages, articles, media).")]},{type:"folder",name:"src",open:!0,children:[{type:"folder",name:"components",children:[{type:"folder",name:"AnimatedText",children:[(0,t.stub)("AnimatedText.astro","Markup + the one script tag that imports the element."),{type:"file",name:"AnimatedTextElement.ts",content:p}]},(0,t.stub)("JsonLd.astro","One JSON-LD script tag: stega-cleans the graph and escapes < so authored copy cannot close the tag."),{type:"folder",name:"InnerParallax",children:[(0,t.stub)("InnerParallax.astro","Parallax wrapper: markup only."),(0,t.stub)("InnerParallaxElement.ts","Scroll-linked transform, compositor-only."),(0,t.stub)("utils.ts","Shared parallax math.")]},{type:"folder",name:"Lenis",children:[(0,t.stub)("Lenis.astro","Smooth scroll mount point."),(0,t.stub)("LenisElement.ts","Lenis lifecycle as a custom element.")]},{type:"folder",name:"Icon",children:[(0,t.stub)("Icon.astro","Inline an SVG from the registry beside it by name."),(0,t.stub)("icon-arrow-up.svg","Arrow up icon."),(0,t.stub)("icon-arrow-down.svg","Arrow down icon."),(0,t.stub)("icon-arrow-left.svg","Arrow left icon."),(0,t.stub)("icon-arrow-right.svg","Arrow right icon."),(0,t.stub)("icon-arrow-up-right.svg","Arrow up-right icon.")]},(0,t.stub)("Button.astro","The one button: link or button, variants via cx.")]},{type:"folder",name:"features",children:[{type:"folder",name:"agents",children:[{type:"file",name:"ai-crawlers.ts",content:t.AI_CRAWLERS_TS},(0,t.stub)("markdown.ts","Serialize a routed document to token-light Markdown."),(0,t.stub)("markdown-proxy-state.ts","Cached CMS read: which paths may be served as Markdown."),(0,t.stub)("query.ts","GROQ for the stored agent Markdown, llms.txt, and alt text fields."),(0,t.stub)("alt-text.ts","The alt text instruction and its normalizer, plus the image-description agent call. Pure enough to unit test.")]},{type:"folder",name:"api",children:[(0,t.stub)("auth.ts","Shared endpoint auth: webhook signatures and tokens.")]},{type:"folder",name:"auth",children:[(0,t.stub)("sanity-basic-auth-proxy.ts","Cached CMS read: site-wide and per-path Basic Auth state.")]},{type:"folder",name:"dom",children:[(0,t.stub)("constants.ts","Breakpoints, shared with the Tailwind theme."),(0,t.stub)("utils.ts","Small DOM helpers used by the custom elements.")]},{type:"folder",name:"mux",children:[(0,t.stub)("utils.ts","Mux playback ids and thumbnail URLs.")]},{type:"folder",name:"page-builder",open:!0,children:[{type:"folder",name:"sections",open:!0,children:[{type:"file",name:"TextSection.astro",content:a},(0,t.stub)("MediaSection.astro","Media section: image, video, Lottie, or Rive."),(0,t.stub)("CtaSection.astro","CTA section: headline, rich text, link."),{type:"folder",name:"ContactFormSection",children:[(0,t.stub)("ContactFormSection.astro","Contact form markup; the element handles submission."),(0,t.stub)("ContactFormElement.ts","Contact form custom element: validation, honeypot, POST.")]}]},{type:"file",name:"PageSections.astro",content:s},{type:"file",name:"queries.ts",content:o},(0,t.stub)("types.ts","SectionProps: docId, sectionKey, isFirst.")]},{type:"folder",name:"blog",children:[(0,t.stub)("ArticleList.astro","The listing the blog index renders: the singleton's copy plus every article, newest first."),(0,t.stub)("queries.ts","The listing query, beside the component that fetches it."),(0,t.stub)("reading-time.ts","Reading time from the Portable Text blocks the page already fetched, so it cannot drift from the body."),(0,t.stub)("format-date.ts","Fixed-locale date, so the rendered day never depends on the runtime's own.")]},{type:"folder",name:"rich-text",children:[(0,t.stub)("fragment.ts","The Portable Text GROQ fragment, block by block."),{type:"folder",name:"blocks",children:[{type:"folder",name:"media-block",children:[(0,t.stub)("fragment.ts","Media block GROQ fragment.")]}]}]},{type:"folder",name:"sanity",children:[{type:"folder",name:"link",children:[(0,t.stub)("SanityLink.astro","One link component for internal, external, file, and anchor links."),(0,t.stub)("SanityLinkIcon.astro","Trailing icon for external and file links."),(0,t.stub)("fragment.ts","Link GROQ fragment: resolves references to a routed href.")]},{type:"folder",name:"media",children:[(0,t.stub)("fragment.ts","Media GROQ fragment: one field, six media types."),(0,t.stub)("constants.ts","Media type names, shared with the schema."),(0,t.stub)("utils.ts","Aspect ratio and playback option helpers."),{type:"folder",name:"image",children:[(0,t.stub)("utils.ts","Sanity image URLs: srcset, crop, LQIP.")]}]},(0,t.stub)("proxy-state.ts","Cached, deduped CMS reads for the middleware gates.")]},{type:"folder",name:"site",children:[(0,t.stub)("SiteShell.astro","Header + footer wrapper around page content."),(0,t.stub)("SiteHeader.astro","CMS-driven header and navigation."),(0,t.stub)("SiteFooter.astro","CMS-driven footer."),(0,t.stub)("SiteNavLink.astro","Nav link with active state."),(0,t.stub)("SiteError.astro","The CMS-driven 404 body."),(0,t.stub)("query.ts","Site singleton query: header, footer, SEO defaults, social profiles for sameAs."),{type:"folder",name:"seo",children:[(0,t.stub)("favicon.ts","Which uploaded icon the stable route serves, and at what size."),(0,t.stub)("fragment.ts","SEO GROQ fragment with Site fallbacks (noIndex resolves to noindex,follow)."),{type:"file",name:"structured-data.ts",content:t.STRUCTURED_DATA},(0,t.stub)("structured-data.test.ts","Unit tests for the JSON-LD builders.")]}]},{type:"folder",name:"spam-prevention",children:[(0,t.stub)("constants.ts","Field names and timing thresholds."),(0,t.stub)("utils.ts","Honeypot + elapsed-time validation, shared by form and endpoint.")]},{type:"folder",name:"style",children:[(0,t.stub)("utils.ts","cx: class merging with tailwind-merge.")]},{type:"folder",name:"umami",children:[(0,t.stub)("tracking.ts","SSR-safe Umami event helpers."),(0,t.stub)("types.ts","Event names and payload types.")]},{type:"folder",name:"utils",children:[(0,t.stub)("common.ts","Small shared utilities."),(0,t.stub)("constants.ts","IS_CLIENT / IS_SERVER runtime guards."),(0,t.stub)("easings.ts","Shared easing curves."),(0,t.stub)("pathname.ts","normalizePathname: one canonical pathname form for the middleware and its state readers.")]}]},{type:"folder",name:"layouts",children:[(0,t.stub)("Web.astro","The page shell: head, SEO, OG, font preloads, the site-level Organization + WebSite JSON-LD graph, transitions, Umami, draft-mode overlay.")]},{type:"folder",name:"lib",children:[{type:"file",name:"cache.ts",content:d},(0,t.stub)("cache-provider.ts","Route cache provider: Vercel's CDN in production, in-memory LRU in dev, with a bypass for draft mode and Basic Auth."),{type:"file",name:"env.ts",content:l},{type:"file",name:"lazy-hydrate.ts",content:m},(0,t.stub)("responsive-sizes.ts","Build a `sizes` attribute from a responsive layout description."),(0,t.stub)("scroll-container.ts","The page scrolls inside <lenis-scroll>, so every scroll reader names it, not the document."),(0,t.stub)("eases.ts","Named easing curves for the elements."),(0,t.stub)("utils.ts","Small shared helpers."),{type:"folder",name:"transitions",children:[(0,t.stub)("page-transitions.ts","Cross-document view transitions."),(0,t.stub)("presets.ts","Named transition presets."),(0,t.stub)("content-ready.ts","Wait for fonts and images before revealing.")]}]},{type:"folder",name:"pages",open:!0,children:[{type:"folder",name:"api",children:[{type:"folder",name:"agent-markdown",children:[(0,t.stub)("[...uri].ts","Serve any routed document as token-light Markdown (the content-negotiation target).")]},{type:"folder",name:"agents",children:[(0,t.stub)("llms-txt.ts","POST: draft a spec-compliant llms.txt from your content with Sanity Agent Actions."),(0,t.stub)("page-markdown.ts","POST: draft one page's agent Markdown with Sanity Agent Actions."),(0,t.stub)("image-alt-text.ts","POST: describe one uploaded image, or backfill a batch of the library. Patches the asset, never the document.")]},{type:"folder",name:"draft-mode",children:[(0,t.stub)("enable.ts","Validate the Presentation preview secret and set the perspective cookie."),(0,t.stub)("disable.ts","Clear the perspective cookie.")]},(0,t.stub)("revalidate.ts","Sanity publish webhook: verify the signature, invalidate the document's cache tags."),(0,t.stub)("contact-form.ts","Contact form endpoint: spam checks, store the submission, send the Resend email."),(0,t.stub)("seo-screenshot.ts","Render a share image for the Studio's SEO preview.")]},{type:"folder",name:"blog",children:[(0,t.stub)("index.astro","Blog index: the blog singleton fetched by id, rendering the article list and a Blog JSON-LD node."),(0,t.stub)("[slug].astro","The prefix-route pattern (/blog/{slug}, generated by plop): rich text body, BlogPosting beside the WebPage node.")]},{type:"file",name:"[...uri].astro",content:n},(0,t.stub)("404.astro","CMS-driven not-found page."),(0,t.stub)("favicon.ico.ts","The one icon Google indexes. A fixed path that resolves to the CMS favicon, so the URL holds still when the asset changes."),(0,t.stub)("llms.txt.ts","Serve the editable llms.txt stored on the Settings singleton."),(0,t.stub)("robots.txt.ts","robots.txt from the shared AI crawler policy, plus the private prefixes and the sitemap pointer."),(0,t.stub)("sitemap.xml.ts","Sitemap from every routed document, with lastmod.")]},{type:"folder",name:"sanity",children:[{type:"folder",name:"lib",children:[{type:"file",name:"load-query.ts",content:r},(0,t.stub)("client.ts","The Sanity client: CDN in dev, live API in production and for drafts."),(0,t.stub)("draft-mode.ts","Read the Presentation perspective cookie off the request.")]},{type:"folder",name:"media",children:[(0,t.stub)("SanityMedia.astro","One component, six media types: dispatches on the media field's type."),(0,t.stub)("SanityImage.astro","Responsive srcset, LQIP placeholder, art direction."),(0,t.stub)("SanityMuxVideo.astro","Mux player, lazily hydrated."),(0,t.stub)("SanityNativeVideo.astro","Native video with poster and playback options."),(0,t.stub)("SanityLottie.astro","Lottie via dotlottie-wc, lazily hydrated."),(0,t.stub)("SanityRive.astro","Rive canvas, lazily hydrated."),(0,t.stub)("RiveElement.ts","Rive runtime as a custom element."),(0,t.stub)("types.ts","Media prop types shared by the renderers.")]},{type:"folder",name:"rich-text",children:[(0,t.stub)("SanityRichText.astro","Portable Text renderer: blocks, marks, and the block registry."),{type:"folder",name:"components",children:[(0,t.stub)("Block.astro","Paragraph and heading styles."),(0,t.stub)("Link.astro","Portable Text link mark."),(0,t.stub)("List.astro","Ordered and unordered lists."),(0,t.stub)("ListItem.astro","One list item, with the indent mark applied."),(0,t.stub)("MediaBlock.astro","The media block inside rich text."),(0,t.stub)("InlineMedia.astro","Inline media inside a paragraph."),(0,t.stub)("TextColor.astro","Text color mark."),(0,t.stub)("HighlightColor.astro","Highlight mark."),(0,t.stub)("Underline.astro","Underline mark."),(0,t.stub)("Sup.astro","Superscript mark."),(0,t.stub)("Indent.astro","Indent mark."),(0,t.stub)("indent-style.ts","Read the indentField mark's widthPercent into a block-level text-indent.")]}]},{type:"file",name:"queries.ts",content:i},(0,t.stub)("seo.ts","Per-page metadata with Site singleton fallbacks, OG images, robots.")]},{type:"folder",name:"styles",children:[(0,t.stub)("tailwind.css","Tailwind v4 @theme: colors, spacing, screens, radii."),(0,t.stub)("typography.css","Fluid type scale: caption, body, headline tokens."),(0,t.stub)("colors.css","Color tokens."),(0,t.stub)("global.css","Base layer and resets."),(0,t.stub)("animations.css","Keyframes shared by the elements."),(0,t.stub)("sanity-rich-text.css","Element styles for Portable Text output."),(0,t.stub)("screens.ts","Breakpoints, exported for the elements that need them in JS.")]},(0,t.stub)("env.d.ts","Astro ambient types."),{type:"file",name:"middleware.ts",content:c}]},{type:"folder",name:"templates",children:[{type:"folder",name:"page-builder-section",children:[(0,t.stub)("schema.tsx.hbs","defineField object for {{name}}."),(0,t.stub)("component.astro.hbs","Self-fetching Astro component for {{name}}."),(0,t.stub)("query.ts.hbs","GROQ query for {{name}}, spliced into queries.ts.")]},{type:"folder",name:"page-route",children:[(0,t.stub)("schema.tsx.hbs","Document schema for {{documentType}}."),(0,t.stub)("page.astro.hbs","Route for /{{routePrefix}}/[slug]."),(0,t.stub)("queries.ts.hbs","Route query for {{documentType}}."),(0,t.stub)("structure.tsx.hbs","Studio list item.")]},{type:"folder",name:"rich-text-block",children:[(0,t.stub)("schema.tsx.hbs","Block schema for {{name}}."),(0,t.stub)("component.astro.hbs","Block renderer."),(0,t.stub)("fragment.ts.hbs","Block GROQ fragment.")]}]},{type:"file",name:".env.example",content:g},{type:"file",name:".gitignore",content:b},{type:"file",name:".lefthookrc",content:A},{type:"file",name:".mcp.json",content:S},{type:"file",name:".npmrc",content:v},{type:"file",name:".nvmrc",content:T},{type:"file",name:"AGENTS.md",content:P},{type:"file",name:"astro.config.mjs",content:u},{type:"file",name:"biome.jsonc",content:x},{type:"file",name:"CLAUDE.md",content:L},{type:"file",name:"GETTING-STARTED.md",content:"# Getting started\n\nThe guided path from a fresh clone to your first rendered section. The README and docs/ are the reference; this file is the walkthrough.\n"},{type:"file",name:"lefthook.yml",content:k},{type:"file",name:"LICENSE.md",content:N},{type:"file",name:"package.json",content:h},{type:"file",name:"package-lock.json",content:f},{type:"file",name:"plopfile.mjs",content:E},{type:"file",name:"README.md",content:R,active:!0},{type:"file",name:"sanity.cli.ts",content:I},{type:"file",name:"sanity.config.ts",content:w},{type:"file",name:"sanity-schema.json",content:C},{type:"file",name:"skills-lock.json",content:'{\n  "_": "Pinned versions for the installed agent skill packs (modern-web-guidance, gsap)."\n}\n'},{type:"file",name:"tsconfig.json",content:y}]},footer:[],terminal:{prompt:">",initialCommand:"cd the-content-architecture-astro"},generators:O};e.s(["astroIdeData",0,M])}]);