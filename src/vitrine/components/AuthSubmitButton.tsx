import { Button } from "@astryxdesign/core";
import type { MouseEvent } from "react";

export function AuthSubmitButton({
  label,
  clickAction,
}: {
  label: string;
  clickAction?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
}) {
  return (
    <div style={{ marginTop: 6, animation: "vtFadeUp .5s cubic-bezier(.16,1,.3,1) .2s both" }}>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        label={label}
        clickAction={clickAction}
        style={{ width: "100%" }}
      />
    </div>
  );
}
