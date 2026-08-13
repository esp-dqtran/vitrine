import { useState } from "react";
import { Button, Heading, Icon, Text, TextInput, type InputStatus } from "@astryxdesign/core";
import { requestPasswordReset, resetPassword } from "./authApi.ts";
import { PasswordField } from "./components/PasswordField.tsx";
import { AuthSubmitButton } from "./components/AuthSubmitButton.tsx";

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "32px", background: "var(--color-background-body)" }}>
      <section style={{ width: "100%", maxWidth: 380 }}>{children}</section>
    </main>
  );
}

export function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<InputStatus>();

  const submit = async () => {
    if (!email.trim() || !email.includes("@")) {
      setStatus({ type: "error", message: "Enter a valid email address" });
      return;
    }
    setBusy(true);
    setStatus(undefined);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch {
      setStatus({ type: "error", message: "Unable to send a reset link. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return <PageShell>{sent ? (
    <>
      <Heading level={1}>Check your email</Heading>
      <Text type="large" color="secondary">If an account exists for {email.trim()}, we sent a password reset link. It expires in 30 minutes.</Text>
      <div style={{ marginTop: 24 }}><Button variant="primary" label="Back to sign in" clickAction={onBack} /></div>
    </>
  ) : (
    <>
      <Heading level={1}>Reset your password</Heading>
      <div style={{ marginTop: 8, marginBottom: 24 }}><Text type="large" color="secondary">Enter your email and we’ll send you a one-time reset link.</Text></div>
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }} style={{ display: "grid", gap: 18 }}>
        <TextInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" status={status} />
        <Button type="submit" variant="primary" label="Send reset link" isLoading={busy} isDisabled={busy} />
      </form>
      <div style={{ marginTop: 18 }}><Button variant="ghost" size="sm" label="Back to sign in" clickAction={onBack} /></div>
    </>
  )}</PageShell>;
}

export function ResetPassword({ token, onBack }: { token?: string; onBack: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<InputStatus>();
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!token) { setStatus({ type: "error", message: "This password reset link is invalid or has expired" }); return; }
    if (password.length < 8) { setStatus({ type: "error", message: "Password must be at least 8 characters" }); return; }
    if (password !== confirmPassword) { setStatus({ type: "error", message: "Passwords do not match" }); return; }
    setBusy(true);
    setStatus(undefined);
    try {
      await resetPassword(token, password);
      setComplete(true);
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Unable to reset password" });
    } finally {
      setBusy(false);
    }
  };

  return <PageShell>{complete ? (
    <>
      <Heading level={1}>Password updated</Heading>
      <div style={{ marginTop: 8, marginBottom: 24 }}><Text type="large" color="secondary">Your password has been reset. You can now sign in.</Text></div>
      <Button variant="primary" label="Sign in" clickAction={onBack} />
    </>
  ) : (
    <>
      <Heading level={1}>Choose a new password</Heading>
      <div style={{ marginTop: 8, marginBottom: 24 }}><Text type="large" color="secondary">Use at least 8 characters.</Text></div>
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }} style={{ display: "grid", gap: 18 }}>
        <PasswordField label="New password" value={password} onChange={setPassword} status={status} />
        <PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />
        <AuthSubmitButton
          label="Reset password"
          clickAction={(event) => {
            event.preventDefault();
            return submit();
          }}
        />
      </form>
      <div style={{ marginTop: 18 }}><Button variant="ghost" size="sm" label="Back to sign in" icon={<Icon icon="chevronLeft" size="sm" />} clickAction={onBack} /></div>
    </>
  )}</PageShell>;
}
