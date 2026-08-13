import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ResetPassword } from "./PasswordRecovery.tsx";

test("uses shared show/hide password fields and sign-in action styling", () => {
  const html = renderToStaticMarkup(<ResetPassword token={"a".repeat(43)} onBack={() => {}} />);
  assert.match(html, /New password/);
  assert.match(html, /Confirm new password/);
  assert.equal((html.match(/Show password/g) ?? []).length, 2);
  assert.match(html, /Reset password/);
  assert.match(html, /<path d="M15 6l-6 6 6 6"><\/path>/);
});
