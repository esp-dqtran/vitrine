import assert from "node:assert/strict";
import test from "node:test";
import { createPasswordResetEmailSender, passwordResetEmailConfigFromEnv } from "./passwordResetEmail.ts";

test("reads Resend settings only as a complete server-side pair", () => {
  assert.equal(passwordResetEmailConfigFromEnv({}), undefined);
  assert.deepEqual(passwordResetEmailConfigFromEnv({
    RESEND_API_KEY: "re_123456789",
    EMAIL_FROM: "Vitrines <security@vitrines.ai>",
  }), {
    apiKey: "re_123456789",
    from: "Vitrines <security@vitrines.ai>",
  });
  assert.throws(() => passwordResetEmailConfigFromEnv({ RESEND_API_KEY: "re_123456789" }), /configured together/);
  assert.throws(() => passwordResetEmailConfigFromEnv({ RESEND_API_KEY: "not-resend", EMAIL_FROM: "security@vitrines.ai" }), /Resend API key/);
});

test("sends the password reset template through Resend's Email API", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const sender = createPasswordResetEmailSender(
    { apiKey: "re_test-key", from: "Vitrines <security@vitrines.ai>" },
    async (url, init) => {
      request = { url: String(url), init };
      return new Response(JSON.stringify({ id: "email-id" }), { status: 200 });
    },
  );
  await sender.send({ to: "member@example.com", resetUrl: "https://vitrines.ai/reset-password?token=abc" });
  assert.equal(request?.url, "https://api.resend.com/emails");
  assert.equal(request?.init?.headers && new Headers(request.init.headers).get("authorization"), "Bearer re_test-key");
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    from: "Vitrines <security@vitrines.ai>",
    to: ["member@example.com"],
    subject: "Reset your Vitrines password",
    text: "Use this one-time link to reset your Vitrines password: https://vitrines.ai/reset-password?token=abc\n\nThis link expires in 30 minutes. If you did not request it, you can ignore this email.",
    html: '<p>Use this one-time link to reset your Vitrines password:</p><p><a href="https://vitrines.ai/reset-password?token=abc">Reset password</a></p><p>This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>',
  });
});
