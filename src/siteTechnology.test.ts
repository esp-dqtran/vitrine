import assert from "node:assert/strict";
import test from "node:test";
import { detectSiteTechnology } from "./siteTechnology.ts";

test("confirms Framer, React DOM, and active Framer Motion from direct evidence", () => {
  const result = detectSiteTechnology({
    generator: ["Framer 94de808"],
    htmlAttributes: { "data-framer-hydrate-v2": "{}" },
    scriptUrls: [
      "https://framerusercontent.com/sites/react.mjs?token=secret",
      "https://framerusercontent.com/sites/motion.mjs",
    ],
    stylesheetUrls: [],
    resourceUrls: [],
    inlineScripts: ["version:`18.2.0`,rendererPackageName:`react-dom`"],
    sourceMapSources: [
      "https://app.framerstatic.com/framer-motion.DNR7HTEP.mjs",
    ],
    runtimes: { reactDom: "18.2.0" },
    activeRuntimeSignals: [
      "framer-motion:VisualElement",
      "framer-motion:useScroll",
    ],
  });

  assert.deepEqual(
    result
      .filter((item) => item.state !== "not-detected")
      .map((item) => item.name),
    ["Framer Sites", "React DOM", "Framer Motion"],
  );
  assert.equal(
    result.find((item) => item.name === "Framer Motion")?.state,
    "observed-in-use",
  );
  assert.equal(
    result.find((item) => item.name === "React DOM")?.version,
    "18.2.0",
  );
  assert.ok(
    result
      .flatMap((item) => item.evidence)
      .every((item) => !item.value.includes("secret")),
  );
});

test("separates loaded Swiper from active GSAP on Webflow", () => {
  const result = detectSiteTechnology({
    generator: ["Webflow"],
    htmlAttributes: { "data-wf-site": "site", class: "w-mod-ix3" },
    scriptUrls: [
      "https://cdn.example/gsap/3.15.0/gsap.min.js",
      "https://cdn.example/gsap/3.15.0/ScrollTrigger.min.js",
      "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js",
    ],
    stylesheetUrls: [],
    resourceUrls: [],
    inlineScripts: ["gsap.registerPlugin(ScrollTrigger,SplitText)"],
    sourceMapSources: [],
    runtimes: {
      gsap: "3.15.0",
      scrollTrigger: "3.15.0",
      three: "128",
    },
    activeRuntimeSignals: ["gsap:timeline:73", "scroll-trigger:1"],
  });

  assert.equal(
    result.find((item) => item.name === "Webflow")?.state,
    "confirmed",
  );
  assert.equal(
    result.find((item) => item.name === "GSAP")?.state,
    "observed-in-use",
  );
  assert.equal(
    result.find((item) => item.name === "GSAP")?.version,
    "3.15.0",
  );
  assert.equal(
    result.find((item) => item.name === "Swiper")?.state,
    "loaded",
  );
  assert.equal(
    result.find((item) => item.name === "Framer Motion")?.state,
    "not-detected",
  );
});

test("keeps the registry ordered and caps evidence", () => {
  const result = detectSiteTechnology({
    generator: [],
    htmlAttributes: {},
    scriptUrls: [
      "https://cdn.example/lottie.min.js",
      "https://cdn.example/lottie-web.js",
    ],
    stylesheetUrls: ["https://cdn.example/lottie.css"],
    resourceUrls: ["https://cdn.example/animation.json"],
    inlineScripts: ["lottie.loadAnimation({container: root})"],
    sourceMapSources: ["webpack:///node_modules/lottie-web/index.js"],
    runtimes: {},
    activeRuntimeSignals: ["lottie:animation:1"],
  });

  assert.deepEqual(result.slice(0, 5).map((item) => item.name), [
    "Framer Sites",
    "React",
    "React DOM",
    "Framer Motion",
    "Webflow",
  ]);
  const lottie = result.find((item) => item.name === "Lottie");
  assert.equal(lottie?.state, "observed-in-use");
  assert.ok((lottie?.evidence.length ?? 0) <= 3);
  assert.ok(
    result
      .flatMap((item) => item.evidence)
      .every((item) => item.value.length <= 512),
  );
});
