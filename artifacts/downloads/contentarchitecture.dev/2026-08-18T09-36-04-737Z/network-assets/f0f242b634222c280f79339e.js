(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,461353,e=>{e.v(t=>Promise.all(["static/immutable/chunks/1u64zg1yvt5z5.js"].map(t=>e.l(t))).then(()=>t(344354)))},988051,e=>{"use strict";let t=(0,e.i(770703).default)(()=>e.A(461353).then(e=>e.CrashScreen),{loadableGenerated:{modules:[344354]}});e.s(["CrashScreen",0,t])},509744,e=>{e.v(t=>Promise.all(["static/immutable/chunks/1dxb-dyj08pik.js"].map(t=>e.l(t))).then(()=>t(490868)))},778213,e=>{"use strict";let t=`import { defineField, defineType } from "sanity";
import { createAgentMarkdownField } from "../fields/create-agent-markdown-field";
import { createPageBuilderField } from "../fields/create-page-builder";
import { createSeoField } from "../fields/create-seo-field";
import { createUriField } from "../fields/create-uri-field";
import { isHomepageDocument } from "../../utils";

// A document knows its role. The homepage is a locked singleton at "/", every
// other page slugs from its title. The same field factories build page and
// every future type, so two schemas never drift apart.

export const page = defineType({
  name: "page",
  type: "document",
  title: "Page",
  groups: [
    { name: "page", title: "Page", default: true },
    { name: "content", title: "Content" },
    { name: "seo", title: "SEO" },
    { name: "agents", title: "Agents" },
  ],
  fields: [
    defineField({ name: "title", type: "string", group: "page" }),
    createUriField({ group: "page", source: "title", readOnly: ({ parent }) => isHomepageDocument(parent) }),
    defineField({ name: "passwordProtected", type: "boolean", group: "page" }),
    createPageBuilderField({ group: "content" }),
    // Same factory pattern throughout. SEO carries noIndex and the share image.
    createSeoField({ group: "seo" }),
    // Agents tab: a Markdown mirror of the page for AI, generated from its
    // content in one click and served on the same URL by content negotiation.
    createAgentMarkdownField({ group: "agents" }),
  ],
});
`,i=`// Document roles, defined once. Singleton IDs are string literals first
// (typegen resolves only literals), then derived into the maps the Studio
// structure, the router, and the sitemap all read, so "where does this live"
// has exactly one answer across the app.

export const SANITY_SINGLETON_SITE_ID = "site";
export const SANITY_SINGLETON_SITE_SETTINGS_ID = "siteSettings";
export const SANITY_SINGLETON_HOMEPAGE_ID = "homepage";
export const SANITY_SINGLETON_BLOG_ID = "blog";

// The blog index sits on its own route, and articles slug under it (/blog/<slug>).
// One constant, so the schema, the route, and the reserved-path rule cannot disagree.
export const SANITY_BLOG_INDEX_URI = "/blog";

export const SINGLETON_IDS = {
  site: SANITY_SINGLETON_SITE_ID,
  siteSettings: SANITY_SINGLETON_SITE_SETTINGS_ID,
  homepage: SANITY_SINGLETON_HOMEPAGE_ID,
  blog: SANITY_SINGLETON_BLOG_ID,
  // PLOP: Add Singleton ID
} as const;

export const SINGLETON_ROUTES = {
  [SINGLETON_IDS.homepage]: "/",
  [SINGLETON_IDS.blog]: SANITY_BLOG_INDEX_URI,
  // PLOP: Add Singleton Route
} as const;

export const SANITY_PAGE_DOCUMENT_TYPE = "page" as const;
export const SANITY_ARTICLE_DOCUMENT_TYPE = "article" as const;
export const API_ONLY_DOCUMENTS = { contactFormSubmission: "contactFormSubmission" } as const;

// Generation targets for the AI agents. Registered so schema-aware Agent Actions
// can type-check against them, never listed in the structure or created by hand.
export const AGENT_SCRATCH_DOCUMENTS = { imageAltText: "imageAltText" } as const;

// Agent Actions live on the experimental channel, and the schema-aware ones
// (transform, generate) resolve field types against the *deployed* schema, not
// the local one: run \`npm run sanity:schema-deploy\` after a schema change.
export const SANITY_AGENT_API_VERSION = "vX" as const;
export const SANITY_AGENT_SCHEMA_ID = "_.schemas.default" as const;
`,n=`import { defineField } from "sanity";
import { composeValidation, requiredIf, requireTypeWhenObjectHasValue, visibleIf } from "../../utils";

// One link field, every shape: internal reference, external URL, email, phone,
// file, or params. Internal links resolve to the live URI at query time, so a
// renamed page never leaves a dead link behind.

const visibleIfType = visibleIf("type");
const requiredIfType = requiredIf("type");
const linkTypeValidation = requireTypeWhenObjectHasValue("Select a link type.");

export function createLinkField({ group, validation, name = "appLink" }: LinkFieldOptions = {}) {
  return defineField({
    name,
    title: "Link",
    type: "object",
    group,
    // Callers add their own rules; the base "pick a type" rule always composes in.
    validation: composeValidation(linkTypeValidation, validation),
    fields: [
      defineField({
        name: "type",
        type: "string",
        options: {
          list: ["internal", "external", "email", "phone", "file", "params"],
        },
      }),
      defineField({
        name: "internal",
        type: "reference",
        // Every routed type: the picker lists anything with a URI, so the reference
        // has to accept the same set or the Studio flags a valid link as invalid.
        to: [{ type: "page" }, { type: "article" }, { type: "blog" }],
        ...visibleIfType("internal"),
      }),
      defineField({
        name: "external",
        type: "url",
        ...visibleIfType("external"),
        ...requiredIfType("external"),
      }),
      defineField({ name: "openInNewTab", type: "boolean" }),
    ],
  });
}
`,o=`import { defineField } from "sanity";
import { composeValidation, requireTypeWhenObjectHasValue, selectByName } from "../../utils";

// One media field, six sources: image, Mux video, self-hosted video file,
// external video URL, Rive, or Lottie. Each normalizes to a single shape that
// returns intrinsic dimensions, so the front end always reserves space and
// layout shift never ships. whitelist/blacklist restrict the options per use.

const MEDIA_TYPES = ["image", "videoMux", "videoFile", "videoUrl", "rive", "lottie"];

export function createMediaField({
  group,
  withCustomRatio,
  whitelist,
  blacklist,
  validation,
  name = "appMedia",
}: MediaFieldOptions = {}) {
  // Mutually exclusive whitelist/blacklist; one shared helper filters every factory.
  const enabledTypes = selectByName(MEDIA_TYPES, (t) => t, { whitelist, blacklist, label: "createMediaField" });

  return defineField({
    name,
    title: "Media",
    type: "object",
    group,
    validation: composeValidation(requireTypeWhenObjectHasValue("Select a media type."), validation),
    fields: [
      defineField({ name: "type", type: "string", options: { list: enabledTypes } }),
      defineField({ name: "image", type: "image", options: { hotspot: true } }),
      defineField({ name: "video", type: "mux.video" }),
      defineField({ name: "videoFile", type: "file", options: { accept: "video/*" } }),
      defineField({ name: "videoUrl", type: "url" }),
      // video file + URL share one native <video>; rive + lottie read back
      // dimensions; aspectRatio is opt-in.
    ],
  });
}
`,a=`import { defineField } from "sanity";
import { sections } from "../page-sections";
import { selectByName } from "../../utils";

// The page builder, with guardrails. Sections are whitelisted or blacklisted
// per document and can be capped (one hero per page). Each entry carries its
// own settings and content, and registers itself, so adding a section never
// means editing the same three files by hand. Settings include a Disabled
// toggle: a parked section dims in the Studio and vanishes from the site,
// instead of being deleted and rebuilt from scratch.

export function createPageBuilderField({
  group,
  whitelist,
  blacklist,
  sectionMaxCount,
}: PageBuilderOptions = {}) {
  // Same shared filter as the link and media factories.
  const enabledSections = selectByName(sections, (s) => s.name, { whitelist, blacklist, label: "createPageBuilderField" });

  return defineField({
    name: "pageBuilder",
    title: "Page Builder",
    type: "object",
    group,
    fields: [
      // A custom rule enforces sectionMaxCount, e.g. { mediaSectionField: 1 }.
      defineField({ name: "sectionsArray", type: "array", of: enabledSections }),
    ],
  });
}
`,r=`import { defineField } from "sanity";
import { kebabCase } from "change-case";
import { composeValidation } from "../../utils";

// Used by every routable document. The homepage locks to "/", every other slug
// normalizes to "/kebab-case", and reserved paths can never be claimed.

export function createUriField({
  group,
  source,
  validation,
  name = "uri",
  readOnly,
  // Prefills the slug for a document whose path is fixed by its route rather than
  // derived from \`source\`. The blog index pairs it with readOnly.
  initialPath,
}: UriFieldOptions) {
  return defineField({
    name,
    title: "URI",
    type: "slug",
    group,
    readOnly,
    initialValue: initialPath ? { current: initialPath } : undefined,
    options: {
      source,
      slugify: (input) => \`/\${kebabCase(input)}\`,
    },
    // The reserved-path rule always composes in: the public Studio URL, the internal
    // route it rewrites to, and the blog index, which only its own singleton may
    // claim. Callers layer their own rules on top.
    validation: composeValidation(reservedPathValidation, validation),
  });
}
`,s=`// Portable Text with two toolbars. "simple" is inline marks only; "full" adds
// headings, lists, and media blocks. Decorators: strong, em, code, sup; marks:
// link, color, highlight, indent. Whitelist per use.

export function createRichTextField({
  group,
  variant = "simple",
  whitelist,
}: RichTextFieldOptions = {}) {
  // returns an array field of block + media members, registered like sections
}
`,l=`import type { StructureBuilder } from "sanity/structure";

// Editors never hunt for a document. Singletons lock to one editable instance;
// routable types get a filtered list. The sidebar mirrors the live site.

function singleton(S: StructureBuilder, opts: { title: string; schemaType: string; id: string }) {
  return S.listItem()
    .title(opts.title)
    .id(opts.id)
    .child(S.document().schemaType(opts.schemaType).documentId(opts.id));
}

export function buildStructure(S: StructureBuilder) {
  return S.list()
    .title("The Content Architecture")
    .items([
      singleton(S, { title: "Homepage", schemaType: "page", id: "homepage" }),
      S.listItem()
        .title("Pages")
        .child(S.documentTypeList("page").filter(\`_type == "page" && _id != "homepage"\`)),
      S.divider(),
      // The blog index is a singleton the route renders; its articles nest under it.
      S.listItem()
        .title("Blog")
        .child(
          S.list()
            .title("Blog")
            .items([
              singleton(S, { title: "Index", schemaType: "blog", id: "blog" }),
              S.listItem().title("Articles").child(S.documentTypeList("article")),
              S.listItem().title("Article Categories").child(S.documentTypeList("articleCategory")),
            ])
        ),
      S.divider(),
      S.listItem().title("Form Submissions").child(S.documentTypeList("contactFormSubmission")),
      S.divider(),
      // Site is the copy that renders on every page; Settings is the configuration
      // behind how it is served, so the two sit side by side instead of nested.
      singleton(S, { title: "Site", schemaType: "site", id: "site" }),
      singleton(S, { title: "Settings", schemaType: "siteSettings", id: "siteSettings" }),
    ]);
}
`,d=`import { contactFormSection } from "./contact-form-section";
import { ctaSection } from "./cta-section";
import { mediaSection } from "./media-section";
import { textSection } from "./text-section";
// PLOP: Add Import

// The schema-side registry. The page builder field whitelists from this list,
// and the plop generator inserts new sections at the markers below.
export const sections = [
  textSection,
  mediaSection,
  ctaSection,
  contactFormSection,
  // PLOP: Add Export
];
`,c=`// JSON-LD builders. Framework-free and Sanity-free: callers pass resolved
// strings, so the shapes stay unit-testable and both editions share this file
// byte for byte.

// Drops undefined/empty members so a half-populated CMS never emits
// "logo": null, which validators reject.
function compact(value: JsonLd): JsonLd {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, v]) => v !== undefined && v !== null && v !== "" && !isEmptyArray(v)
    )
  );
}

export function organizationLd({ name, url, logo, sameAs }: OrganizationInput) {
  return compact({
    "@type": "Organization",
    "@id": \`\${url}/#organization\`,
    name,
    url,
    logo,
    sameAs,
  });
}

/** Each page carries its own @id so no two URLs share a WebPage identity. */
export function webPageLd({ name, url, description, siteUrl }: WebPageInput) {
  return compact({
    "@type": "WebPage",
    "@id": \`\${url}#webpage\`,
    url,
    name,
    description,
    isPartOf: { "@id": \`\${siteUrl}/#website\` },
    about: { "@id": \`\${siteUrl}/#organization\` },
    inLanguage: "en",
  });
}

/**
 * The article as a work, which is not the same node as the page presenting it: the
 * WebPage is the URL, the BlogPosting is what was written. mainEntityOfPage joins
 * them, so a crawler reads one article on one URL rather than two competing
 * descriptions of it.
 */
export function blogPostingLd({ headline, url, siteUrl, datePublished, authorName }: BlogPostingInput) {
  return compact({
    "@type": "BlogPosting",
    "@id": \`\${url}#article\`,
    url,
    headline,
    datePublished,
    author: authorName ? { "@type": "Person", name: authorName } : undefined,
    publisher: { "@id": \`\${siteUrl}/#organization\` },
    isPartOf: { "@id": \`\${url}#webpage\` },
    mainEntityOfPage: { "@id": \`\${url}#webpage\` },
    inLanguage: "en",
  });
}

/** Wraps nodes in the single @context envelope crawlers expect per script. */
export function jsonLdGraph(nodes: object[]): JsonLd {
  return { "@context": "https://schema.org", "@graph": nodes };
}
`,p=`// AI crawler policy: search and citation yes, model training no.
//
// Hosts and CDNs increasingly inject their own AI-crawler blocks into robots.txt at the
// edge, so the served policy quietly becomes a property of where the site runs rather
// than of the site itself. Moving hosts then changes the policy without a commit.
// Declared here, it stays in version control and travels with the content.

// Blocked. These collect content to train models and send no traffic or attribution
// back. Blocking them costs nothing in search: Google-Extended governs Gemini and
// Vertex grounding, never Google Search or AI Overviews, and GPTBot is training-only,
// separate from the agents ChatGPT actually searches with.
export const AI_TRAINING_CRAWLERS = [
  "Amazonbot",
  "Applebot-Extended",
  "Bytespider",
  "GPTBot",
  "Google-Extended",
  "meta-externalagent",
] as const;

// Allowed. Answer engines that fetch a page in order to cite it, which is the half of
// AI traffic worth having. Listed explicitly rather than left to fall through
// "User-agent: *", so the intent is recorded and so this group still wins if something
// upstream merges a broad block into the file.
export const AI_CITATION_CRAWLERS = [
  "CCBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "OAI-SearchBot",
  "Perplexity-User",
  "PerplexityBot",
] as const;

// Content Signals (contentsignals.org) state what may be done with a page once it has
// been crawled, which user-agent groups cannot express: they gate the fetch, not the
// use. Also an express reservation of rights under Article 4 of EU Directive 2019/790.
export const CONTENT_SIGNAL = "search=yes,ai-train=no,use=reference";

// A crawler obeys only the most specific group matching its name and ignores every
// other group (RFC 9309). So each named group has to repeat the site's own disallows,
// or naming an agent would quietly invite it into the paths "*" keeps out.
function renderGroup(group: RobotsGroup): string[] {
  return [
    ...group.userAgents.map((agent) => \`User-agent: \${agent}\`),
    ...(group.contentSignal ? [\`Content-Signal: \${group.contentSignal}\`] : []),
    ...(group.allow ?? []).map((path) => \`Allow: \${path}\`),
    ...(group.disallow ?? []).map((path) => \`Disallow: \${path}\`),
    "",
  ];
}

// The whole robots.txt body. Each stack's route only supplies its private prefixes,
// so the policy itself is written once and cannot drift between the two editions.
export function renderRobotsTxt(options: { disallow: readonly string[]; sitemap: string }): string {
  return [
    "# Search and citation are welcome. Training is not.",
    "",
    ...renderGroup({
      userAgents: ["*"],
      contentSignal: CONTENT_SIGNAL,
      allow: ["/"],
      disallow: options.disallow,
    }),
    ...renderGroup({ userAgents: AI_CITATION_CRAWLERS, allow: ["/"], disallow: options.disallow }),
    ...renderGroup({ userAgents: AI_TRAINING_CRAWLERS, disallow: ["/"] }),
    \`Sitemap: \${options.sitemap}\`,
    "",
  ].join("\\n");
}
`;e.s(["AI_CRAWLERS_TS",0,p,"CONSTANTS_TS",0,i,"CREATE_LINK",0,n,"CREATE_MEDIA",0,o,"CREATE_PAGE_BUILDER",0,a,"CREATE_RICH_TEXT",0,s,"CREATE_URI_FIELD",0,r,"PAGE_SCHEMA",0,t,"PAGE_SECTIONS_SCHEMA_INDEX",0,d,"STRUCTURED_DATA",0,c,"STRUCTURE_TSX",0,l,"skill",0,function(e,t){return{type:"file",name:`${e}.md`,content:`# ${e}

${t}
`}},"stub",0,function(e,t){return{type:"file",name:e,content:`// ${t}
`}}])},772742,e=>{"use strict";let t=null;e.s(["playPostBeep",0,function(){let e=t;if(e?.state!=="running")return;let i=e.currentTime,n=e.createOscillator(),o=e.createGain();n.type="square",n.frequency.setValueAtTime(800,i),o.gain.setValueAtTime(0,i),o.gain.linearRampToValueAtTime(.06,i+.012),o.gain.setValueAtTime(.06,i+.17),o.gain.linearRampToValueAtTime(0,i+.2),n.connect(o),o.connect(e.destination),n.start(i),n.stop(i+.22)},"primeBiosAudio",0,function(){let e=window.AudioContext??window.webkitAudioContext;e&&(t||(t=new e),"suspended"===t.state&&t.resume().catch(()=>void 0))}])}]);