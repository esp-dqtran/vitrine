import { useLayoutEffect, useRef, useState } from "react";
import { Icon, IconButton, TextInput, type InputStatus } from "@astryxdesign/core";

export function PasswordField({
  value,
  onChange,
  status,
  label = "Password",
}: {
  value: string;
  onChange: (value: string) => void;
  status?: InputStatus;
  label?: string;
}) {
  const [show, setShow] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // TextInput's rendered label/status height is not a public sizing API, so
  // measure its actual input and keep the show/hide control centered on it.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const button = buttonRef.current;
    const input = wrap?.querySelector("input");
    if (!wrap || !button || !input) return;
    const wrapRect = wrap.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    button.style.top = `${inputRect.top - wrapRect.top + inputRect.height / 2}px`;
    button.style.right = `${wrapRect.right - inputRect.right}px`;
  });

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <TextInput label={label} type={show ? "text" : "password"} value={value} onChange={onChange} placeholder="••••••••" status={status} />
      <IconButton
        ref={buttonRef}
        type="button"
        onClick={() => setShow((current) => !current)}
        label={show ? "Hide password" : "Show password"}
        icon={<Icon icon="eyeSlash" size="sm" />}
        variant="ghost"
        size="sm"
        style={{ position: "absolute", transform: "translateY(-50%)" }}
      />
    </div>
  );
}
