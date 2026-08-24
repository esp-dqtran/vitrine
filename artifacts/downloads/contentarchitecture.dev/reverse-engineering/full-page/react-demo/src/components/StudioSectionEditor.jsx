import { useEffect, useMemo, useRef, useState } from "react";
import { Reorder, useDragControls } from "motion/react";

const LINK_OPTIONS = [
  ["📄 Internal Link", "internal"],
  ["🌍 External Link", "external"],
  ["📧 Email", "email"],
  ["☎️ Phone", "phone"],
  ["📃 File", "file"],
  ["🎛️ URL Params", "params"],
];

const MEDIA_OPTIONS = [
  ["🖼️ Image", "image"],
  ["🎥 Mux Video", "videoMux"],
  ["🎬 Video file", "videoFile"],
  ["🔗 Video URL", "videoUrl"],
  ["🕹️ Rive", "rive"],
  ["✨ Lottie", "lottie"],
];

const RICH_TEXT = {
  styles: [["Normal", "normal"], ["Caption", "caption"]],
  lists: [],
  decorators: [["Strong", "strong"], ["Emphasis", "em"]],
  link: true,
};

const richText = (title = "Text") => ({
  name: "appRichText",
  title,
  type: "richText",
  editable: true,
  richText: RICH_TEXT,
});

const editable = (name, title, type = "string") => ({ name, title, type, editable: true });
const optionList = (options) => options.map(([title, value]) => ({ title, value }));

export const STUDIO_MANIFEST = {
  mainHeroSection: {
    icon: "🦸",
    title: "Main Hero",
    fields: [
      editable("eyebrow", "Eyebrow"),
      editable("title", "Title", "text"),
      richText(),
      { name: "action", title: "Action", type: "radio", options: optionList([["Email Capture", "emailCapture"], ["CTA", "CTA"]]) },
      { name: "appLink", title: "CTA", type: "link", options: optionList(LINK_OPTIONS) },
    ],
  },
  textTerminalSection: {
    icon: "⌨️",
    title: "Text Terminal",
    fields: [
      editable("eyebrow", "Eyebrow"),
      editable("title", "Title"),
      richText(),
      editable("terminalCommand", "Terminal Command"),
      { name: "terminalLines", title: "Terminal Lines", type: "array", of: [editable("label", "Label"), editable("tag", "Tag")] },
      editable("terminalFooter", "Terminal Footer"),
    ],
  },
  benefitsSection: {
    icon: "✨",
    title: "Benefits",
    fields: [
      editable("title", "Title", "text"),
      richText(),
      { name: "items", title: "Items", type: "array", of: [editable("title", "Title"), editable("text", "Text", "text")] },
    ],
  },
  ideSection: {
    icon: "❓",
    title: "IDE",
    fields: [
      editable("title", "Title"),
      editable("terminalHint", "Terminal hint"),
      { name: "showCta", title: "Show CTA", type: "boolean" },
      { name: "ctaLink", title: "CTA", type: "link", options: optionList(LINK_OPTIONS) },
      editable("ctaNote", "CTA note"),
      editable("ctaFileLabel", "CTA file label"),
    ],
  },
  showcaseSection: {
    icon: "🏆",
    title: "Showcase",
    fields: [
      editable("title", "Title"),
      richText(),
      {
        name: "items",
        title: "Items",
        type: "array",
        of: [
          { name: "appMedia", title: "Media", type: "media", options: optionList(MEDIA_OPTIONS) },
          editable("title", "Title"),
        ],
      },
    ],
  },
  testimonialsSection: {
    icon: "💬",
    title: "Testimonials",
    fields: [
      {
        name: "items",
        title: "Items",
        type: "array",
        of: [
          editable("quote", "Quote", "text"),
          editable("author", "Author"),
          editable("role", "Role"),
          editable("company", "Company"),
          { name: "avatar", title: "Avatar", type: "image" },
        ],
      },
    ],
  },
  pricingSection: {
    icon: "💰",
    title: "Pricing",
    fields: [
      { name: "purchasesPaused", title: "Pause purchases", type: "boolean" },
      editable("title", "Title", "text"),
      editable("footnote", "Footnote", "text"),
      editable("sharedItemsTitle", "Shared terms title"),
      { name: "sharedItems", title: "Shared terms", type: "array", of: [editable("value", "Text")] },
      {
        name: "items",
        title: "Plans",
        type: "array",
        of: [
          editable("name", "Plan name"),
          editable("price", "Price"),
          editable("compareAtPrice", "Compare-at Price"),
          editable("comingSoonLabel", "Coming soon label"),
          editable("comingSoonNote", "Coming soon note"),
          editable("label", "Label"),
          editable("plan", "Plan"),
          editable("discountCode", "Discount code"),
          { ...richText("CTA Note"), name: "ctaNote" },
        ],
      },
    ],
  },
  faqSection: {
    icon: "🙋",
    title: "Faq",
    fields: [
      editable("title", "Title"),
      { name: "items", title: "Items", type: "array", of: [editable("question", "Question"), richText("Answer")] },
      { name: "cta", title: "CTA", type: "link", options: optionList(LINK_OPTIONS) },
    ],
  },
  calloutSection: {
    icon: "💡",
    title: "Callout",
    fields: [editable("eyebrow", "Eyebrow"), editable("text", "Text", "text")],
  },
};

function findField(sectionElement, name) {
  if (!sectionElement) return null;
  return Array.from(sectionElement.querySelectorAll("[data-studio-field]")).find(
    (element) => element.dataset.studioField === name,
  ) || null;
}

function readFieldText(sectionElement, name) {
  const field = findField(sectionElement, name);
  const accessibleText = field?.querySelector('[role="text"][aria-label]')?.getAttribute("aria-label");
  if (accessibleText) return accessibleText.replace(/\s+/g, " ").trim();
  const source = field?.querySelector(".sr-only") || field;
  return (source?.textContent || "").replace(/\s+/g, " ").trim();
}

function writeFieldText({ fieldName, onChangeHero, sectionElement, sectionType, value }) {
  if (sectionType === "mainHeroSection") {
    const heroKey = fieldName === "appRichText" ? "lede" : fieldName;
    if (["eyebrow", "title", "lede"].includes(heroKey)) {
      onChangeHero(heroKey, value);
      return;
    }
  }

  const target = findField(sectionElement, fieldName);
  if (target) target.textContent = value;
  dispatchEvent(new Event("resize"));
  dispatchEvent(new Event("studio:remeasure"));
}

function focusPageField(sectionElement, name) {
  const target = findField(sectionElement, name);
  target?.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "center",
  });
}

function centerInStudioPanel(element) {
  const scroller = element?.closest(".studio-panel__content");
  if (!element || !scroller) return;
  const scrollerRect = scroller.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const offset = Math.max(0, (scroller.clientHeight - elementRect.height) / 2);
  scroller.scrollTo({
    top: Math.max(0, scroller.scrollTop + elementRect.top - scrollerRect.top - offset),
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
}

function StudioFieldShell({ children, title }) {
  return (
    <div className="studio-editor-field">
      <span className="studio-editor-field__label">{title}</span>
      {children}
    </div>
  );
}

function StudioTextField({ field, fieldName, focusField, onChangeHero, onFocusField, sectionElement, sectionType }) {
  const [value, setValue] = useState(() => readFieldText(sectionElement, fieldName));
  const inputRef = useRef(null);

  useEffect(() => {
    setValue(readFieldText(sectionElement, fieldName));
  }, [fieldName, sectionElement]);

  useEffect(() => {
    if (focusField !== fieldName || !inputRef.current) return;
    inputRef.current.focus({ preventScroll: true });
    centerInStudioPanel(inputRef.current);
    focusPageField(sectionElement, fieldName);
  }, [fieldName, focusField, sectionElement]);

  const update = (next) => {
    setValue(next);
    writeFieldText({ fieldName, onChangeHero, sectionElement, sectionType, value: next });
  };
  const focus = () => {
    onFocusField(fieldName);
    focusPageField(sectionElement, fieldName);
  };

  return (
    <StudioFieldShell title={field.title}>
      {field.type === "text" ? (
        <textarea ref={inputRef} rows="3" spellCheck="false" value={value} onChange={(event) => update(event.target.value)} onFocus={focus} />
      ) : (
        <input ref={inputRef} type="text" autoComplete="off" spellCheck="false" value={value} onChange={(event) => update(event.target.value)} onFocus={focus} />
      )}
    </StudioFieldShell>
  );
}

function StudioRichTextField({ field, fieldName, focusField, onChangeHero, onFocusField, sectionElement, sectionType }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current) editorRef.current.textContent = readFieldText(sectionElement, fieldName);
  }, [fieldName, sectionElement]);

  useEffect(() => {
    if (focusField !== fieldName || !editorRef.current) return;
    editorRef.current.focus({ preventScroll: true });
    centerInStudioPanel(editorRef.current);
    focusPageField(sectionElement, fieldName);
  }, [fieldName, focusField, sectionElement]);

  const config = field.richText || RICH_TEXT;
  const command = (name, value) => {
    editorRef.current?.focus({ preventScroll: true });
    document.execCommand(name, false, value);
  };
  const update = () => writeFieldText({
    fieldName,
    onChangeHero,
    sectionElement,
    sectionType,
    value: editorRef.current?.textContent || "",
  });

  return (
    <StudioFieldShell title={field.title}>
      <div className="studio-rich-text">
        <div className="studio-rich-text__toolbar" role="toolbar" aria-label={`${field.title} formatting`}>
          {config.styles?.length > 1 ? (
            <select aria-label="Text style" defaultValue={config.styles[0][1]} onChange={(event) => command("formatBlock", event.target.value === "caption" ? "p" : event.target.value)}>
              {config.styles.map(([title, value]) => <option value={value} key={value}>{title}</option>)}
            </select>
          ) : null}
          {config.styles?.length > 1 && config.decorators?.length ? <i aria-hidden="true" /> : null}
          {config.decorators?.map(([title, value]) => (
            <button
              type="button"
              aria-label={title}
              key={value}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => command(value === "strong" ? "bold" : value === "em" ? "italic" : value === "sup" ? "superscript" : "formatBlock", value === "code" ? "pre" : undefined)}
            >{value === "strong" ? <b>B</b> : value === "em" ? <em>i</em> : value === "sup" ? "x²" : "<>"}</button>
          ))}
          {config.lists?.length ? <i aria-hidden="true" /> : null}
          {config.lists?.map(([title, value]) => (
            <button type="button" aria-label={title} key={value} onPointerDown={(event) => event.preventDefault()} onClick={() => command(value === "number" ? "insertOrderedList" : "insertUnorderedList")}>{value === "number" ? "1." : "•"}</button>
          ))}
          {config.link ? (
            <>
              <i aria-hidden="true" />
              <button type="button" aria-label="Link" onPointerDown={(event) => event.preventDefault()} onClick={() => {
                const href = window.prompt("URL", "https://");
                if (href) command("createLink", href);
              }}>🔗</button>
            </>
          ) : null}
        </div>
        <div
          ref={editorRef}
          className="studio-rich-text__editor"
          contentEditable
          role="textbox"
          aria-multiline="true"
          spellCheck="false"
          suppressContentEditableWarning
          onFocus={() => {
            onFocusField(fieldName);
            focusPageField(sectionElement, fieldName);
          }}
          onInput={update}
        />
      </div>
    </StudioFieldShell>
  );
}

function StudioOptions({ options, sublabel }) {
  return (
    <div className="studio-option-list">
      {sublabel ? <span>{sublabel}</span> : null}
      <div>{options.map((option, index) => <span className={index === 0 ? "is-active" : ""} key={option.value}>{option.title}</span>)}</div>
    </div>
  );
}

function StudioMediaField({ field, fieldName, focusField, sectionElement }) {
  const shellRef = useRef(null);
  const [image] = useState(() => findField(sectionElement, fieldName)?.querySelector("img") || null);
  const src = image?.currentSrc || image?.src;

  useEffect(() => {
    if (focusField === fieldName) centerInStudioPanel(shellRef.current);
  }, [fieldName, focusField]);

  return (
    <div ref={shellRef}>
      <StudioFieldShell title={field.title}>
        {src ? (
          <span className="studio-media-preview"><img src={src} srcSet={image.srcset || undefined} sizes={image.srcset ? "300px" : undefined} alt="" /></span>
        ) : field.options?.length ? (
          <StudioOptions options={field.options} sublabel="Media Type" />
        ) : (
          <span className="studio-editor-placeholder">No preview</span>
        )}
      </StudioFieldShell>
    </div>
  );
}

function StudioStaticField({ field }) {
  if (field.type === "boolean") {
    return (
      <div className="studio-editor-boolean">
        <span>{field.title}</span>
        <i aria-hidden="true"><b /></i>
      </div>
    );
  }
  if (field.type === "richText") {
    return (
      <StudioFieldShell title={field.title}>
        <div className="studio-rich-text is-static">
          <div className="studio-rich-text__toolbar"><span>No style ▾</span><i /><b>B</b><em>i</em><span>🔗</span><span>…</span></div>
          <div className="studio-rich-text__editor">Rich text</div>
        </div>
      </StudioFieldShell>
    );
  }
  return <StudioFieldShell title={field.title}><span className={`studio-editor-placeholder${field.type === "text" ? " is-tall" : ""}`}>&nbsp;</span></StudioFieldShell>;
}

function StudioFieldView(props) {
  const { field, fieldName, sectionElement } = props;
  if (!findField(sectionElement, fieldName)) return null;
  if (["string", "text"].includes(field.type)) return field.editable ? <StudioTextField {...props} /> : <StudioStaticField field={field} />;
  if (field.type === "richText") return field.editable && field.richText ? <StudioRichTextField {...props} /> : <StudioStaticField field={field} />;
  if (["media", "image"].includes(field.type)) return <StudioMediaField {...props} />;
  if (field.type === "boolean") return <StudioStaticField field={field} />;
  if (["link", "radio"].includes(field.type)) {
    return <StudioFieldShell title={field.title}><StudioOptions options={field.options || []} sublabel={field.type === "link" ? "Link Type" : undefined} /></StudioFieldShell>;
  }
  return null;
}

function StudioArrayItem({ field, focusField, index, onChangeHero, onFocusField, reorderable, sectionElement, sectionType }) {
  const controls = useDragControls();
  const contents = (
    <>
      {reorderable ? (
        <div className="studio-array-item__handle">
          <button type="button" aria-label={`Reorder ${field.title} item ${index + 1}`} onPointerDown={(event) => controls.start(event)}>⋮⋮</button>
        </div>
      ) : null}
      <div className="studio-array-item__fields">
        {(field.of || []).map((child) => {
          const fieldName = `${field.name}.${index}.${child.name}`;
          return (
            <StudioFieldView
              field={child}
              fieldName={fieldName}
              focusField={focusField}
              key={child.name}
              onChangeHero={onChangeHero}
              onFocusField={onFocusField}
              sectionElement={sectionElement}
              sectionType={sectionType}
            />
          );
        })}
      </div>
    </>
  );

  return reorderable ? (
    <Reorder.Item value={index} dragListener={false} dragControls={controls} className="studio-array-item">{contents}</Reorder.Item>
  ) : <div className="studio-array-item">{contents}</div>;
}

function StudioArrayField({ field, focusField, onChangeHero, onFocusField, sectionElement, sectionType }) {
  const indices = useMemo(() => {
    const prefix = `${field.name}.`;
    const values = new Set();
    sectionElement?.querySelectorAll("[data-studio-field]").forEach((element) => {
      const name = element.dataset.studioField || "";
      if (!name.startsWith(prefix)) return;
      const index = Number.parseInt(name.slice(prefix.length).split(".")[0] || "", 10);
      if (Number.isInteger(index)) values.add(index);
    });
    return Array.from(values).sort((a, b) => a - b);
  }, [field.name, sectionElement]);
  const indicesKey = indices.join(",");
  const [order, setOrder] = useState(indices);

  useEffect(() => setOrder(indices), [indicesKey]);
  if (!indices.length) return null;

  const reorderable = indices.every((index) => sectionElement?.querySelector(`[data-studio-item="${field.name}.${index}"]`));
  const renderItems = (values) => values.map((index) => (
    <StudioArrayItem
      field={field}
      focusField={focusField}
      index={index}
      key={index}
      onChangeHero={onChangeHero}
      onFocusField={onFocusField}
      reorderable={reorderable}
      sectionElement={sectionElement}
      sectionType={sectionType}
    />
  ));
  const reorder = (next) => {
    setOrder(next);
    const nodes = next.map((index) => sectionElement?.querySelector(`[data-studio-item="${field.name}.${index}"]`)).filter(Boolean);
    for (let index = 1; index < nodes.length; index += 1) nodes[index - 1].after(nodes[index]);
    dispatchEvent(new Event("resize"));
    dispatchEvent(new Event("studio:remeasure"));
  };

  return (
    <StudioFieldShell title={field.title}>
      <div className="studio-array-list">
        {reorderable ? <Reorder.Group axis="y" values={order} onReorder={reorder}>{renderItems(order)}</Reorder.Group> : renderItems(indices)}
      </div>
    </StudioFieldShell>
  );
}

export function StudioSectionEditor({ focusField, onChangeHero, onFocusField, section }) {
  const sectionElement = document.querySelectorAll("[data-page-builder-section]")[section.index] || null;
  const meta = STUDIO_MANIFEST[section.type];
  if (!sectionElement || !meta) return <p className="studio-panel__empty">This section has no recovered field manifest.</p>;

  return (
    <div className="studio-panel__stack studio-panel__form studio-section-editor">
      {meta.fields.map((field) => field.type === "array" ? (
        <StudioArrayField
          field={field}
          focusField={focusField}
          key={field.name}
          onChangeHero={onChangeHero}
          onFocusField={onFocusField}
          sectionElement={sectionElement}
          sectionType={section.type}
        />
      ) : (
        <StudioFieldView
          field={field}
          fieldName={field.name}
          focusField={focusField}
          key={field.name}
          onChangeHero={onChangeHero}
          onFocusField={onFocusField}
          sectionElement={sectionElement}
          sectionType={section.type}
        />
      ))}
      <p className="studio-panel__note">Demo only. Edits are local and reset on reload. Everything here is editable in Sanity Studio.</p>
    </div>
  );
}
