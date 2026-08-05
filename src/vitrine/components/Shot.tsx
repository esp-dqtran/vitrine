import type { CSSProperties } from "react";
import { Text } from "@astryxdesign/core";
import type { PreviewPlatform } from "../useCatalogPreview.ts";
import { AppIcon } from "./AppIcon.tsx";

export interface ShotSource {
  url: string;
  platform: PreviewPlatform;
  appName: string;
  iconUrl?: string | null;
  /** Real brand colour from the catalog; tints the glow behind the frame only. */
  accent?: string | null;
  /** Short factual line under the frame, e.g. "Utilities · 154 screens". */
  meta?: string | null;
}

/**
 * A catalog screenshot framed by the device it was captured on, so a bright
 * light-mode capture reads as *a screen inside* the dark page instead of a
 * light rectangle pasted onto it. The screenshot itself is never dimmed,
 * recoloured or cropped — the frame wraps the capture's own aspect ratio, so
 * every pixel the catalog stored is on the page. On a product that sells
 * accurate references, the pixels have to stay honest. The only styling that
 * touches colour is the accent glow behind the frame, which is the app's own
 * brand colour from the catalog.
 */
export function Shot({
  shot,
  eager = false,
  style,
}: {
  shot: ShotSource;
  eager?: boolean;
  style?: CSSProperties;
}) {
  const isPhone = shot.platform !== "web";
  const alt = `${shot.appName} — real ${
    isPhone ? "mobile" : "web"
  } screen captured in the Vitrines catalog`;

  return (
    <figure style={{ margin: 0, position: "relative", ...style }}>
      {shot.accent && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "-14% -10% 8%",
            borderRadius: "50%",
            background: `radial-gradient(closest-side, ${shot.accent}, transparent 72%)`,
            opacity: 0.18,
            filter: "blur(46px)",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        style={{
          position: "relative",
          borderRadius: isPhone ? 34 : 14,
          padding: isPhone ? 5 : 0,
          overflow: "hidden",
          border: "1px solid var(--color-border)",
          background: "#17181b",
          boxShadow: "0 30px 84px rgba(0,0,0,.42)",
        }}
      >
        {!isPhone && (
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 28,
              paddingInline: 12,
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            {["#3a3c41", "#3a3c41", "#3a3c41"].map((dot, i) => (
              <span
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: dot,
                }}
              />
            ))}
          </div>
        )}
        <img
          src={shot.url}
          alt={alt}
          // Preview media 302s to short-lived presigned URLs; a stale
          // redirect fails the load. One delayed retry fetches a fresh
          // signature instead of leaving alt text in the layout.
          onError={(event) => {
            const img = event.currentTarget;
            if (img.dataset.retried) return;
            img.dataset.retried = "1";
            setTimeout(() => {
              img.src =
                shot.url + (shot.url.includes("?") ? "&" : "?") + "retry=1";
            }, 900);
          }}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          style={{
            display: "block",
            width: "100%",
            // Natural height: the capture's own aspect ratio decides the
            // frame. No object-fit, no crop — the full screen is shown.
            height: "auto",
            borderRadius: isPhone ? 29 : 0,
            background: "#0f1012",
          }}
        />
      </div>
      {(shot.iconUrl || shot.meta) && (
        <figcaption
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            marginTop: 12,
            minWidth: 0,
          }}
        >
          {shot.iconUrl && (
            <AppIcon name={shot.appName} iconUrl={shot.iconUrl} accent={shot.accent} size={22} />
          )}
          <span style={{ minWidth: 0, display: "grid" }}>
            <Text type="body">{shot.appName}</Text>
            {shot.meta && (
              <Text type="supporting" color="secondary">
                {shot.meta}
              </Text>
            )}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
