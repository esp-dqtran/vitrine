import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { GlyphFieldBackdrop } from "../recovered/glyph/GlyphFieldBackdrop.jsx";
import { FOOTER_GLYPH_DATA } from "../recovered/glyph/glyphData.js";
import { OdometerWord } from "./SplitButton.jsx";

const footerLinks = [
  { key: "blog", label: "Blog", href: "/blog" },
  { label: "Roadmap", href: "https://www.contentarchitecture.dev/roadmap" },
  { key: "pricing", label: "Get access", href: "/#pricing", status: true },
  { label: "Privacy Policy", href: "https://www.contentarchitecture.dev/legal/privacy-policy" },
  { label: "Terms Of Service", href: "https://www.contentarchitecture.dev/legal/terms-of-service" },
];

const SPAM_MESSAGES = {
  honeypot: "Invalid submission detected. Please refresh the page and try again.",
  tooFast: "Please take your time filling out the form. Form submissions are processed after a brief delay.",
  noInteraction: "Please interact with the form fields before submitting. Click or type in the fields to continue.",
};

function validateEmail(value) {
  const email = value.trim();
  if (!email) return { ok: false, error: "Enter your email address." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  return { ok: true, email };
}

function NewsletterForm() {
  const formRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const interactedRef = useRef(false);
  const submitTimerRef = useRef(0);
  const resetTimerRef = useRef(0);
  const emailId = useId();
  const errorId = useId();
  const successId = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => () => {
    window.clearTimeout(submitTimerRef.current);
    window.clearTimeout(resetTimerRef.current);
  }, []);

  const recordInteraction = () => {
    interactedRef.current = true;
  };

  const reset = () => {
    setSuccess(false);
    setEmail("");
    setError(null);
    interactedRef.current = false;
    startTimeRef.current = Date.now();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting || success) return;

    const validation = validateEmail(email);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    const honeypot = new FormData(formRef.current).get("website");
    const elapsed = Date.now() - startTimeRef.current;
    if (String(honeypot || "").trim()) {
      setError(SPAM_MESSAGES.honeypot);
      return;
    }
    if (elapsed < 1000) {
      setError(SPAM_MESSAGES.tooFast);
      return;
    }
    if (!interactedRef.current) {
      setError(SPAM_MESSAGES.noInteraction);
      return;
    }

    setError(null);
    setSubmitting(true);
    submitTimerRef.current = window.setTimeout(() => {
      setSubmitting(false);
      setSuccess(true);
      resetTimerRef.current = window.setTimeout(reset, 4000);
    }, 250);
  };

  const disabled = submitting || success;
  const describedBy = success ? successId : error ? errorId : undefined;

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      onKeyDown={recordInteraction}
      onMouseMove={recordInteraction}
      onTouchStart={recordInteraction}
      onClick={recordInteraction}
    >
      <input
        className="site-footer__honeypot"
        type="text"
        name="website"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
      />
      <label htmlFor={emailId}>Email</label>
      <div className="site-footer__form-row">
        <input
          id={emailId}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="your@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={disabled}
          readOnly={success}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
        <button type="submit" aria-label="Stay updated" disabled={disabled}>
          <span><OdometerWord>Stay</OdometerWord></span>
          <i aria-hidden="true" />
          <span><OdometerWord>Updated</OdometerWord></span>
        </button>
      </div>
      {success ? <p id={successId} role="status" className="site-footer__form-success">You&apos;re on the list.</p> : null}
      {!success && error ? <p id={errorId} role="alert" className="site-footer__form-error">{error}</p> : null}
    </form>
  );
}

export function SiteFooter({ onNavigate }) {
  const footerRef = useRef(null);
  const contentRef = useRef(null);
  const veilRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const footer = footerRef.current;
    const content = contentRef.current;
    const veil = veilRef.current;
    if (!footer || !content || !veil) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      if (prefersReducedMotion) {
        content.style.transform = "none";
        veil.style.opacity = "0";
        return;
      }
      const height = footer.offsetHeight;
      const limit = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const remaining = limit - window.scrollY;
      const reveal = height ? Math.min(Math.max(remaining / height, 0), 1) : 0;
      content.style.transform = `translate3d(0, ${reveal * height * 0.3}px, 0)`;
      veil.style.opacity = String(0.7 * reveal);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(footer);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [prefersReducedMotion]);

  return (
    <footer ref={footerRef} className="site-footer" data-studio-chrome="showFooter">
      <GlyphFieldBackdrop data={FOOTER_GLYPH_DATA} />
      <div ref={contentRef} className="site-footer__scroll">
        <div className="site-footer__layout">
          <div className="site-footer__top">
            <div className="site-footer__newsletter">
              <NewsletterForm />
            </div>
            <nav aria-label="Footer">
              {footerLinks.map(({ key, label, href, status }) => (
                <a href={href} key={label} onClick={(event) => onNavigate?.({ key, label, href }, event)}>
                  <OdometerWord>{label}</OdometerWord>
                  {status ? (
                    <span aria-hidden="true" className="site-footer__status">
                      <span />
                      <span />
                    </span>
                  ) : null}
                </a>
              ))}
            </nav>
          </div>
          <div className="site-footer__meta">
            <div aria-hidden="true" className="site-footer__rule" />
            <div>
              <p>© <span>2026</span> The Content Architecture</p>
              <a href="https://edoardolunardi.dev/">Built by edoardolunardi.dev</a>
            </div>
          </div>
        </div>
      </div>
      <div ref={veilRef} aria-hidden="true" className="site-footer__veil" />
    </footer>
  );
}
