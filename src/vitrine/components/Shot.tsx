import type { CSSProperties } from "react";
import { Text } from "@astryxdesign/core";
import type { PreviewPlatform } from "../useCatalogPreview.ts";

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

const PHONE_ASPECT = "9 / 19.5";
const BROWSER_ASPECT = "16 / 10";

/**
 * A catalog screenshot framed by the device it was captured on, so a bright
 * light-mode capture reads as *a screen inside* the dark page instead of a
 * light rectangle pasted onto it. The screenshot itself is never dimmed or
 * recoloured — on a product that sells accurate references, the pixels have to
 * stay honest. The only styling that touches colour is the accent glow behind
 * the frame, which is the app's own brand colour from the catalog.
 */
export function Shot({
  shot,
  eager = false,
  aspect,
  style,
}: {
  shot: ShotSource;
  eager?: boolean;
  /** Override the frame's aspect, e.g. a taller crop to fill a bento card. */
  aspect?: string;
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
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          style={{
            display: "block",
            width: "100%",
            aspectRatio: aspect ?? (isPhone ? PHONE_ASPECT : BROWSER_ASPECT),
            objectFit: "cover",
            // Top-align: a screenshot's header and first content block carry the
            // meaning; centre-cropping a tall phone capture throws both away.
            objectPosition: "top center",
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
            <img
              src={shot.iconUrl}
              alt=""
              aria-hidden="true"
              width={22}
              height={22}
              loading="lazy"
              style={{ borderRadius: 6, flex: "none" }}
            />
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
