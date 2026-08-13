import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ScreenGridCard,
  screenAccessibleLabel,
} from "./components/ScreenGridCard.tsx";
import type { Screen } from "./types.ts";

const screen: Screen = {
  id: 42,
  type: "Settings",
  productArea: "Account",
  theme: "dark",
  visibleStates: ["Default"],
  platform: "ios",
  description: null,
  url: "/media/full-screen.png",
  thumbnailUrl: "/media/thumb-screen.webp",
  sourceUrl: "https://mobbin.com/screens/42",
};

test("renders Screen cards from the full source without cropping or badge overlays", () => {
  const html = renderToStaticMarkup(
    <ScreenGridCard
      screen={screen}
      accent="#3399ff"
      delay={0}
      onOpen={() => undefined}
    />,
  );

  assert.match(html, /src="\/media\/full-screen\.png"/);
  assert.doesNotMatch(html, /thumb-screen\.webp/);
  assert.doesNotMatch(html, /srcSet=/);
  assert.match(html, /object-fit:contain/);
  assert.doesNotMatch(html, /object-fit:cover/);
  assert.doesNotMatch(html, /scale\(1\.04\)/);
  assert.doesNotMatch(html, />Account</);
  assert.doesNotMatch(html, />Default</);
});

test("uses a consistent 16:10 frame without cropping Web Screen images", () => {
  const html = renderToStaticMarkup(
    <ScreenGridCard
      screen={{ ...screen, platform: "web" }}
      accent="#3399ff"
      delay={0}
      onOpen={() => undefined}
    />,
  );

  assert.match(html, /aspect-ratio:16\/10/);
  assert.match(html, /object-fit:contain/);
  assert.doesNotMatch(html, /object-fit:cover/);
});

test("renders hover collection and copy actions inside the card without a source action", () => {
  const html = renderToStaticMarkup(
    <ScreenGridCard
      screen={screen}
      accent="#3399ff"
      delay={0}
      onOpen={() => undefined}
      appName="Amazon Shopping"
      appId="amazon-shopping"
      collections={[]}
      onCollectionsChange={() => undefined}
      plan="pro"
      flowNames={["Checkout"]}
    />,
  );

  assert.match(html, />Save</);
  assert.match(html, />Copy image</);
  const saveButton =
    html.match(
      /<button[^>]*screen-grid-card__save[^>]*>[\s\S]*?<\/button>/,
    )?.[0] ?? "";
  const copyButton =
    html.match(
      /<button[^>]*screen-grid-card__copy[^>]*>[\s\S]*?<\/button>/,
    )?.[0] ?? "";
  assert.match(saveButton, /data-variant="primary"/);
  assert.match(copyButton, /data-variant="secondary"/);
  assert.match(html, /Open Amazon Shopping, Settings/);
  assert.match(html, /screen-grid-card__media[\s\S]*screen-grid-card__actions/);
  assert.doesNotMatch(html, /Highlight/);
  assert.doesNotMatch(html, /Open source screen/);
});

test("shows only the canonical screen category, never the source facet set", () => {
  const html = renderToStaticMarkup(
    <ScreenGridCard
      screen={{
        ...screen,
        type: "Login",
        matchedFacets: [
          { group: "screens", value: "Signup" },
          { group: "screens", value: "Login" },
          { group: "screens", value: "Confirmation" },
          { group: "screens", value: "Emails & Messages" },
        ],
      }}
      accent="#3399ff"
      delay={0}
      onOpen={() => undefined}
    />,
  );

  assert.match(html, /screen-grid-card__patterns/);
  assert.match(html, />Login</);
  assert.doesNotMatch(html, />Signup</);
  assert.doesNotMatch(html, />Confirmation</);
  assert.doesNotMatch(html, />Emails &amp; Messages</);
});

test("can hand the production Save action to an owning workflow", () => {
  const html = renderToStaticMarkup(
    <ScreenGridCard
      screen={screen}
      accent="#3399ff"
      delay={0}
      onOpen={() => undefined}
      onSave={() => undefined}
    />,
  );

  assert.match(html, />Save</);
  assert.match(html, /screen-grid-card__save/);
  assert.match(html, /data-variant="primary"/);
  assert.match(html, />Copy image</);
});

test("uses a Remove action when the card is rendered inside a collection", () => {
  const html = renderToStaticMarkup(
    <ScreenGridCard
      screen={screen}
      accent="#3399ff"
      delay={0}
      onOpen={() => undefined}
      onRemove={() => undefined}
    />,
  );

  assert.match(html, />Remove</);
  assert.doesNotMatch(html, />Save</);
  assert.match(html, /screen-grid-card__remove/);
});

test("builds meaningful accessible labels without leaking database ids", () => {
  const unclassified: Screen = {
    ...screen,
    id: 1852073,
    type: "Unclassified",
    productArea: "Unclassified",
    visibleText: ["Check your email for a code"],
  };

  assert.equal(
    screenAccessibleLabel(unclassified, "Aboard", ["Onboarding"]),
    "Aboard, Check your email for a code",
  );
  assert.doesNotMatch(screenAccessibleLabel(unclassified, "Aboard"), /1852073/);
});
