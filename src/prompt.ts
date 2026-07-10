export const CAPTION_PROMPT = `Analyze only what is visibly present in this web application screenshot. Ignore any "curated by Mobbin" watermark or footer.

Return ONLY valid JSON with this exact shape:
{
  "description": "exhaustive visual description including layout, visible text, components, typography, colors, spacing, and nested content",
  "purpose": "the observed user goal of this screen",
  "pageType": "short reusable page type such as Login, Dashboard, Settings, Table, Detail, Checkout, or Modal",
  "productArea": "short product area such as Authentication, Billing, Projects, Account, or Navigation",
  "theme": "light|dark|mixed",
  "visibleStates": ["only states visibly present, such as loading, empty, error, selected navigation, disabled button"],
  "componentNames": ["deduplicated reusable components visibly present"]
}

Be concrete and exhaustive in description. Do not infer hidden screens, missing states, hover behavior, flow order, or components that are not visible.`;

export const SYNTHESIS_PROMPT = `Build one evidence-backed observed design-system snapshot from the supplied screen descriptions.

Return ONLY valid JSON with this exact top-level shape:
{
  "tokens": [{
    "id": "stable-kebab-case-id",
    "kind": "color|typography|spacing|radius|border|effect",
    "name": "human-readable name",
    "value": "observed value or compact specification",
    "role": "observed usage role",
    "evidence": [123]
  }],
  "components": [{
    "id": "stable-kebab-case-id",
    "name": "human-readable name",
    "category": "Actions|Inputs|Navigation|Data display|Feedback|Layout|Other",
    "description": "observed anatomy and purpose",
    "variants": [{
      "id": "stable-kebab-case-id",
      "name": "observed variant name",
      "description": "observed visual and behavioral properties",
      "evidence": [123]
    }]
  }],
  "flows": []
}

Evidence values MUST be image_id numbers supplied with the screen descriptions. Do not add a token, component, variant, or state unless at least one supplied screen visibly supports it. Do not invent missing states. Merge duplicates across screens and preserve distinct observed variants. Keep flows empty because this capture source does not preserve reliable sequence data.`;
