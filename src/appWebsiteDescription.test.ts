import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseAppWebsiteDescription,
  normalizeWebsiteDescription,
} from "./appWebsiteDescription.ts";

test("prefers visible hero copy over metadata", () => {
  assert.deepEqual(chooseAppWebsiteDescription([
    {
      text: "A generic search description for the product and its website.",
      source: "metadata",
      position: 0,
    },
    {
      text: "Aboard builds reliable software and secure AI solutions for companies modernizing their technology stack.",
      source: "hero",
      position: 0,
    },
  ], "Aboard"), {
    description: "Aboard builds reliable software and secure AI solutions for companies modernizing their technology stack.",
    source: "hero",
  });
});

test("rejects cookie, CTA, question, and update copy", () => {
  assert.equal(normalizeWebsiteDescription("Accept all cookies to continue using this website and access its content."), null);
  assert.equal(normalizeWebsiteDescription("Ready to transform your company with the future of artificial intelligence?"), null);
  assert.equal(normalizeWebsiteDescription("June 2026 — Welcoming new hires, celebrating your team, connecting AI."), null);
  assert.equal(normalizeWebsiteDescription("Book a demo to discover everything our product can do for your team."), null);
  assert.equal(normalizeWebsiteDescription("The page you are looking for doesn't exist or has been moved."), null);
  assert.equal(normalizeWebsiteDescription("Please go to the Disney Plus home page by clicking the button below."), null);
  assert.equal(normalizeWebsiteDescription("Get 20% off your first payment today. Use code WELCOME20 for this limited-time deal."), null);
  assert.equal(normalizeWebsiteDescription("Initializing WordPress importer and connecting the CMS through the REST API detected on this page."), null);
  assert.equal(normalizeWebsiteDescription("Sign-ups to Fey are closed, but the work continues with another financial company."), null);
  assert.equal(normalizeWebsiteDescription("Posh isn't available in your country. Please email support with any questions."), null);
  assert.equal(normalizeWebsiteDescription("This website is using a security service to protect itself from online attacks. The action triggered the security solution."), null);
  assert.equal(normalizeWebsiteDescription("Anubis uses a proof-of-work scheme in the vein of Hashcash to reduce automated traffic."), null);
  assert.equal(normalizeWebsiteDescription("I always loved IKEA and their furniture and catalogues. But this app is just a nightmare."), null);
  assert.equal(normalizeWebsiteDescription("Coursera is generally a great platform and app. I’ve used it for a few years."), null);
});

test("uses official page metadata before unrelated body copy", () => {
  assert.deepEqual(chooseAppWebsiteDescription([
    {
      text: "Read our latest news and discover what happened at this week's company event.",
      source: "body",
      position: 0,
    },
    {
      text: "Framer helps teams design and publish responsive websites with an integrated visual canvas and content management system.",
      source: "metadata",
      position: 0,
    },
  ], "Framer"), {
    description: "Framer helps teams design and publish responsive websites with an integrated visual canvas and content management system.",
    source: "metadata",
  });
});

test("falls back to factual body copy when the hero is unusable", () => {
  assert.deepEqual(chooseAppWebsiteDescription([
    {
      text: "Run people operations.",
      source: "hero",
      position: 0,
    },
    {
      text: "Aboard brings all your people data into one platform and turns it into insights, overviews, and answers when needed.",
      source: "body",
      position: 1,
    },
  ], "Aboard"), {
    description: "Aboard brings all your people data into one platform and turns it into insights, overviews, and answers when needed.",
    source: "body",
  });
});

test("does not treat testimonials or embedded assistant prompts as product copy", () => {
  assert.equal(chooseAppWebsiteDescription([
    {
      text: "We absolutely love this! Thanks so much for your great review and we're so happy that you love Monarch!",
      source: "body",
      position: 0,
    },
    {
      text: "You are a helpful customer service assistant. Use the available tools to look up order information and help customers.",
      source: "hero",
      position: 0,
    },
  ], "Monarch"), null);
});

test("keeps the first two factual sentences from longer official descriptions", () => {
  assert.equal(
    normalizeWebsiteDescription(
      "Find top designers and creative professionals on Dribbble. Designers gain inspiration, feedback, community, and jobs. Connect with designers worldwide.",
    ),
    "Find top designers and creative professionals on Dribbble. Designers gain inspiration, feedback, community, and jobs.",
  );
});
