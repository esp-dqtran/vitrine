import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ConsentSwitch } from "./primitives/ConsentSwitch";

const categories = [
  {
    key: "necessary",
    title: "Strictly necessary",
    description: "These cover signing in, security, and accessibility, and are always on.",
  },
  {
    key: "measurement",
    title: "Analytics",
    description: "These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site.",
  },
  {
    key: "marketing",
    title: "Marketing",
    description: "These cookies may be set through our site by advertising partners, to build a profile of interests and show relevant ads on other sites.",
  },
];

export function CookiePreferencesDialog({ open, onAcceptAll, onOpenChange, onRejectAll, onSave, onSelectionChange, selection }) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (open) {
      triggerRef.current = document.activeElement;
      if (!dialog.open) dialog.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = previousOverflow; };
    }
    if (dialog.open) dialog.close();
    return undefined;
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const preventEscape = (event) => event.preventDefault();
    const returnFocus = () => triggerRef.current?.focus?.();
    dialog.addEventListener("cancel", preventEscape);
    dialog.addEventListener("close", returnFocus);
    return () => {
      dialog.removeEventListener("cancel", preventEscape);
      dialog.removeEventListener("close", returnFocus);
    };
  }, []);

  const dismiss = () => onOpenChange(false);
  const setCategory = (key, checked) => {
    if (key === "necessary") return;
    onSelectionChange({ ...selection, [key]: checked, necessary: true });
  };
  const save = () => { onSave({ ...selection, necessary: true }); dismiss(); };
  const reject = () => { onRejectAll(); dismiss(); };
  const accept = () => { onAcceptAll(); dismiss(); };

  return createPortal(
    <dialog
      aria-labelledby="consent-dialog-title"
      className="cookie-preferences-dialog"
      data-testid="consent-dialog-root"
      onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}
      ref={dialogRef}
      tabIndex={-1}
    >
      <section aria-describedby="consent-dialog-description" className="cookie-preferences-dialog__card">
        <header className="cookie-preferences-dialog__header">
          <h2 id="consent-dialog-title">Privacy settings</h2>
          <p id="consent-dialog-description">You can change these at any time from the footer</p>
        </header>
        <div className="cookie-preferences-dialog__content">
          <div className="cookie-preferences-dialog__categories">
            {categories.map((category) => <div className="cookie-preferences-dialog__category" key={category.key}>
              <div>
                <h3>{category.title}</h3>
                <p>{category.description}</p>
              </div>
              <ConsentSwitch
                checked={category.key === "necessary" ? true : Boolean(selection[category.key])}
                disabled={category.key === "necessary"}
                label={category.title}
                onCheckedChange={(checked) => setCategory(category.key, checked)}
              />
            </div>)}
          </div>
          <div className="cookie-preferences-dialog__actions">
            <button className="cookie-preferences-dialog__save" onClick={save} type="button">Save settings</button>
            <div>
              <button onClick={reject} type="button">Reject all</button>
              <button className="cookie-preferences-dialog__accept" onClick={accept} type="button">Accept all</button>
            </div>
          </div>
        </div>
      </section>
    </dialog>,
    document.body,
  );
}
