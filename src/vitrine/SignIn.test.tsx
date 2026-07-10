import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { SignIn } from "./SignIn.tsx";

test("renders only the real email/password authentication controls", () => {
  const html = renderToStaticMarkup(
    <SignIn
      authenticate={async () => ({ id: 1, email: "admin@example.com", role: "admin" })}
      onSignedIn={() => {}}
    />
  );

  assert.match(html, /Email/);
  assert.match(html, /Password/);
  assert.match(html, /Sign in/);
  assert.doesNotMatch(html, /Continue with Google/);
});
