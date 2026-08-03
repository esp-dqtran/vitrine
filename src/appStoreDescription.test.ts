import assert from "node:assert/strict";
import test from "node:test";
import {
  appleStoreCountry,
  appleStoreId,
  chooseAppStoreDescription,
  googlePlayId,
} from "./appStoreDescription.ts";

test("extracts Apple and Google store identities", () => {
  assert.equal(
    appleStoreId("https://apps.apple.com/gb/app/example/id1533591596"),
    "1533591596",
  );
  assert.equal(
    appleStoreId("https://itunes.apple.com/us/app/example/id1211813334?mt=8"),
    "1211813334",
  );
  assert.equal(appleStoreCountry("https://apps.apple.com/gb/app/example/id1533591596"), "gb");
  assert.equal(
    googlePlayId("https://play.google.com/store/apps/details?id=com.example.app&hl=en"),
    "com.example.app",
  );
});

test("selects concise product copy from a long store listing", () => {
  assert.equal(
    chooseAppStoreDescription(
      "Everyone deserves the benefits of moving smarter. That’s why we created Aaptiv, an AI-powered audio and video fitness app that creates personalized workout plans and on-demand classes led by expert trainers.\n\nFEATURES:\nSmartCoach helps tailor every workout.",
    ),
    "Everyone deserves the benefits of moving smarter. That’s why we created Aaptiv, an AI-powered audio and video fitness app that creates personalized workout plans and on-demand classes led by expert trainers.",
  );
});

test("rejects release notes, reviews, and privacy boilerplate", () => {
  assert.equal(
    chooseAppStoreDescription("Improved stability and bug fixes. Things now has a refreshed app icon and interface."),
    null,
  );
  assert.equal(
    chooseAppStoreDescription("I never write app reviews, but my husband and I are huge fans of this product."),
    null,
  );
  assert.equal(
    chooseAppStoreDescription("The developer, Brainly, indicated that the app’s privacy practices may include handling data as described below."),
    null,
  );
  assert.equal(
    chooseAppStoreDescription("Wealthfront does not provide tax advice. Consult a tax professional."),
    null,
  );
  assert.equal(
    chooseAppStoreDescription("We offer in-app purchases for Splitwise Pro, the benefits of which are described below."),
    null,
  );
});

test("decodes store HTML before selecting the description", () => {
  assert.equal(
    chooseAppStoreDescription("Plan together &amp; split expenses with friends.<br><br>Track shared balances without complicated spreadsheets."),
    "Plan together & split expenses with friends. Track shared balances without complicated spreadsheets.",
  );
});

test("compacts an overly long official opening sentence at a useful clause", () => {
  assert.equal(
    chooseAppStoreDescription(
      "adidas Running is an activity tracker designed for all levels of ability and experience, offering the ideal platform for beginners to start tracking their running journey and logging activities across every kind of workout and training plan while adapting guidance to their ability, schedule, personal goals, preferred distances, and progress over time.",
      "adidas Running",
    ),
    "adidas Running is an activity tracker designed for all levels of ability and experience.",
  );
});
