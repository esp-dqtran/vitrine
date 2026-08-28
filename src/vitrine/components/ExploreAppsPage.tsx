// Palmer is retained as a runnable, source-audited React artifact. Mounting it
// here gives /explore the host application's auth session and App navigation.
// @ts-expect-error The reverse-engineered artifact is authored in JSX.
import { PalmerHomePage } from "../../../artifacts/reverse-engineering/palmer-dinnerware/prototype/src/pages/PalmerHomePage.jsx";

export interface ExploreAppsPageProps {
  role: "admin" | "user" | undefined;
  onOpenApp(appId: string): void;
  onGuestLimitReached(): void;
}

export function ExploreAppsPage({ role, onOpenApp, onGuestLimitReached }: ExploreAppsPageProps) {
  return (
    <PalmerHomePage
      catalogSessionKey={role ?? "guest"}
      onGuestLimitReached={onGuestLimitReached}
      onOpenApp={onOpenApp}
    />
  );
}
