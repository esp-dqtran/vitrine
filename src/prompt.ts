import type { DesignSystemSnapshot } from "./designSystem.ts";

const CAPTION_INTRO: Record<string, string> = {
  web: `Analyze only what is visibly present in this web application screenshot.`,
  ios: `Analyze only what is visibly present in this iOS application screenshot. Expect native iOS chrome such as the status bar, tab bar, navigation bar, and swipe/gesture affordances — describe these as observed elements, not inferred ones.`,
  android: `Analyze only what is visibly present in this Android application screenshot. Expect Material Design patterns such as the system navigation bar, bottom navigation, and floating action buttons — describe these as observed elements, not inferred ones.`,
};

export function buildCaptionPrompt(platform: string): string {
  return `${CAPTION_INTRO[platform] ?? CAPTION_INTRO.web} Ignore any "curated by Mobbin" watermark or footer.

Return ONLY valid JSON with this exact shape:
{
  "description": "exhaustive visual description including layout, visible text, components, typography, colors, spacing, and nested content",
  "purpose": "the observed user goal of this screen",
  "pageType": "short reusable page type such as Login, Dashboard, Settings, Table, Detail, Checkout, or Modal",
  "productArea": "short product area such as Authentication, Billing, Projects, Account, or Navigation",
  "theme": "light|dark|mixed",
  "visibleStates": ["only states visibly present, such as loading, empty, error, selected navigation, disabled button"],
  "componentNames": ["deduplicated reusable components visibly present"],
  "visibleText": ["important visible labels and content, copied exactly"],
  "layoutPatterns": ["observed layout regions or patterns such as fixed sidebar, centered form, split pane, dense table"],
  "icons": ["visibly identifiable icon names or treatments"],
  "imagery": ["observed illustration, photography, avatar, thumbnail, or decorative-image treatments"],
  "contentPatterns": ["observed writing or information patterns such as helper text, metadata row, confirmation copy"],
  "interactionPatterns": ["only interaction affordances visibly evidenced, such as tabs, disclosure, pagination, bulk selection"],
  "responsiveViewport": "desktop|tablet|mobile|unknown",
  "confidence": 0.0
}

Confidence is from 0 to 1 and reflects how clearly the screenshot supports the structured observations. Be concrete and exhaustive in description. Do not infer hidden screens, missing states, hover behavior, flow order, or components that are not visible.`;
}

const SYNTHESIS_PLATFORM_NOTE: Record<string, string> = {
  web: "web application",
  ios: "iOS application — native platform conventions (system nav, gestures) are part of the observed design language, not implementation detail to discard",
  android: "Android application — native platform conventions (system nav, gestures) are part of the observed design language, not implementation detail to discard",
};

export function buildSynthesisPrompt(platform: string): string {
  return `Build one evidence-backed observed design-system snapshot for this ${SYNTHESIS_PLATFORM_NOTE[platform] ?? SYNTHESIS_PLATFORM_NOTE.web} from the supplied screen descriptions. Do not propose tokens, components, or interaction patterns that belong to a different platform (e.g. no CSS hover states for a native app, no native tab-bar tokens for a web app).

Return ONLY valid JSON with this exact top-level shape:
{
  "tokens": [{
    "id": "stable-kebab-case-id",
    "kind": "color|typography|spacing|radius|border|effect",
    "name": "human-readable name",
    "value": "observed value or compact specification",
    "role": "observed usage role",
    "evidence": [123],
    "confidence": 0.0,
    "responsiveViewports": ["desktop"]
  }],
  "components": [{
    "id": "stable-kebab-case-id",
    "name": "human-readable name",
    "category": "Actions|Inputs|Navigation|Data display|Feedback|Layout|Other",
    "description": "observed anatomy and purpose",
    "anatomy": ["visible named parts"],
    "associatedTokenIds": ["ids from tokens above"],
    "responsiveBehavior": ["only differences visibly supported by multiple viewports"],
    "variants": [{
      "id": "stable-kebab-case-id",
      "name": "observed variant name",
      "description": "observed visual and behavioral properties",
      "evidence": [123],
      "observedProperties": ["properties that distinguish this variant"],
      "observedStates": ["only states visible in evidence"],
      "responsiveViewports": ["desktop"],
      "confidence": 0.0
      ,"reconstruction": {
        "layoutMode": "HORIZONTAL|VERTICAL",
        "width": 0,
        "height": 0,
        "padding": 0,
        "gap": 0,
        "fill": "observed hex color when measurable",
        "stroke": "observed hex color when measurable",
        "radius": 0,
        "visibleText": "representative visible text from evidence"
      }
    }]
  }],
  "rules": [{
    "id": "stable-kebab-case-id",
    "kind": "layout|icon|imagery|responsive|content|interaction",
    "name": "observed rule name",
    "description": "observed pattern without extrapolation",
    "evidence": [123],
    "confidence": 0.0
  }],
  "flows": []
}

Evidence values MUST be image_id numbers supplied with the screen descriptions. Do not add a token, component, variant, or state unless at least one supplied screen visibly supports it. Do not invent missing states. Merge duplicates across screens and preserve distinct observed variants. Keep flows empty because this capture source does not preserve reliable sequence data.`;
}

export function buildMergePrompt(platform: string, a: DesignSystemSnapshot, b: DesignSystemSnapshot): string {
  return `${buildSynthesisPrompt(platform)}

You are merging two independently observed structured snapshots of the SAME ${SYNTHESIS_PLATFORM_NOTE[platform] ?? SYNTHESIS_PLATFORM_NOTE.web} into one. Each snapshot below was built from a different subset of screens, so the same token, component, or rule may appear in both under a different id or slightly different wording — merge those into a single entry and union their "evidence" arrays rather than keeping duplicates. Keep every distinct observed variant from either snapshot. Return one JSON object in the exact shape above containing only the merged result — not a diff, not commentary.

Snapshot A:
${JSON.stringify(a)}

Snapshot B:
${JSON.stringify(b)}`;
}
