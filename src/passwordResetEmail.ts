export interface PasswordResetEmailSender {
  send(input: { to: string; resetUrl: string }): Promise<void>;
}

export interface PasswordResetEmailConfig {
  apiKey: string;
  from: string;
}

export function passwordResetEmailConfigFromEnv(
  environment: Record<string, string | undefined>,
): PasswordResetEmailConfig | undefined {
  const apiKey = environment.RESEND_API_KEY?.trim();
  const from = environment.EMAIL_FROM?.trim();
  if (!apiKey && !from) return undefined;
  if (!apiKey || !from) throw new Error("RESEND_API_KEY and EMAIL_FROM must be configured together");
  if (!apiKey.startsWith("re_")) throw new Error("RESEND_API_KEY must be a Resend API key");
  if (/[\r\n]/.test(from) || from.length > 320) throw new Error("EMAIL_FROM is invalid");
  return { apiKey, from };
}

export function createPasswordResetEmailSender(
  config: PasswordResetEmailConfig,
  request: typeof fetch = fetch,
): PasswordResetEmailSender {
  return {
    async send({ to, resetUrl }) {
      const response = await request("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
        from: config.from,
        to: [to],
        subject: "Reset your Vitrines password",
        text: `Use this one-time link to reset your Vitrines password: ${resetUrl}\n\nThis link expires in 30 minutes. If you did not request it, you can ignore this email.`,
        html: `<p>Use this one-time link to reset your Vitrines password:</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>`,
        }),
      });
      if (!response.ok) throw new Error(`Resend email delivery failed (${response.status})`);
    },
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
