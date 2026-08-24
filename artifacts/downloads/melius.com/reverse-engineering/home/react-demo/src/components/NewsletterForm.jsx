import { useState } from "react";

const ARROW_PATHS = ["M3 11.001h15.5v2H3z", "m14.201 18.701-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4 6.7 6.7z"];

export function NewsletterForm({ dataId = "footer-newsletter", endpoint = "/api/newsletter", onSubmit, placeholder = "Enter your email" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle");

  async function submit(event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setState("loading");
    try {
      if (onSubmit) await onSubmit(email);
      else {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        if (!response.ok) throw new Error("Submission failed");
      }
      setState("success");
    } catch (error) {
      console.error("Newsletter submission error:", error);
      setState("error");
    }
  }

  return <form className="newsletter-form" data-state={state} onSubmit={submit}>
    {state === "idle" || state === "loading" ? <div className="newsletter-form__fields">
      <div className="newsletter-form__control-group">
        <div className={`newsletter-form__control${email ? " is-filled" : ""}`}><input autoComplete="email" id={`email-${dataId}`} inputMode="email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder={placeholder} required type="email" value={email} /></div>
        <button aria-label="Subscribe" className={state === "loading" ? "is-loading" : ""} disabled={state === "loading"} type="submit"><svg aria-hidden="true" fill="#0e0e0e" viewBox="0 0 24 24">{ARROW_PATHS.map((path) => <path d={path} key={path} />)}</svg></button>
      </div>
    </div> : null}
    {state === "success" ? <div className="newsletter-form__success" role="status">Thanks for subscribing!</div> : null}
    {state === "error" ? <div className="newsletter-form__error" role="alert"><p>Something went wrong. Please try again.</p><button onClick={() => { setEmail(""); setState("idle"); }} type="button">Try Again</button></div> : null}
  </form>;
}
