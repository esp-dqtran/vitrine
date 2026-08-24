

(function () {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hero = document.querySelector(".taste-footer-embed .hero");
  if (!hero) return;
  const heroHTML = hero.innerHTML;
  const NBSP = String.fromCharCode(160);
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+=-/";

  let headline, caption, units = [];
  let frame = 0, queue = [], raf = 0;
  let finished = false;
  let hlBase = "";

  const RESULTS_DELAY = 3000;
  const AMBIENT_MIN = 1600, AMBIENT_MAX = 4200;

  function ambientGlitch() {
    if (finished || reduce || !headline || !hlBase) return;
    if (headline.textContent !== hlBase) return;
    const pos = [];
    for (let i = 0; i < hlBase.length; i++) if (/[A-Za-z]/.test(hlBase[i])) pos.push(i);
    if (!pos.length) return;
    const idx = pos[(Math.random() * pos.length) | 0];
    const dur = 8 + ((Math.random() * 10) | 0);
    let f = 0;
    (function step() {
      if (finished || !headline) return;
      if (f >= dur) { headline.textContent = hlBase; return; }
      const arr = hlBase.split("");
      arr[idx] = CHARS[(Math.random() * CHARS.length) | 0];
      headline.textContent = arr.join("");
      f++;
      requestAnimationFrame(step);
    })();
  }
  function scheduleAmbient() {
    setTimeout(() => { ambientGlitch(); scheduleAmbient(); },
      AMBIENT_MIN + Math.random() * (AMBIENT_MAX - AMBIENT_MIN));
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function scrambleTo(toText) {
    const old = headline.textContent;
    const len = Math.max(old.length, toText.length);
    queue = [];
    for (let i = 0; i < len; i++) {
      queue.push({
        from: old[i] || "", to: toText[i] || "",
        start: Math.floor(Math.random() * 28), end: 28 + Math.floor(Math.random() * 42), c: "",
      });
    }
    cancelAnimationFrame(raf);
    frame = 0;
    tick();
  }
  function tick() {
    let out = "", done = 0;
    for (let i = 0; i < queue.length; i++) {
      const q = queue[i];
      if (frame >= q.end) { done++; out += q.to; }
      else if (frame >= q.start) {
        if (!q.c || Math.random() < 0.3) q.c = CHARS[Math.floor(Math.random() * CHARS.length)];
        out += '<span class="scramble-dim">' + q.c + "</span>";
      } else out += q.from;
    }
    headline.innerHTML = out;
    if (done < queue.length) { raf = requestAnimationFrame(tick); frame++; }
    else headline.textContent = queue.map((q) => q.to).join("");
  }

  function scrambleAway(el) {
    if (!el) return;
    if (reduce) { el.textContent = ""; return; }
    const items = el.textContent.split("").map((ch) => ({
      space: ch === " ",
      end: 8 + Math.floor(Math.random() * 26),
      c: "",
    }));
    let f = 0;
    (function step() {
      let out = "", done = 0;
      for (const it of items) {
        if (f >= it.end) { done++; }
        else if (it.space) out += " ";
        else {
          if (!it.c || Math.random() < 0.35) it.c = CHARS[Math.floor(Math.random() * CHARS.length)];
          out += it.c;
        }
      }
      el.textContent = out;
      if (done < items.length) { f++; requestAnimationFrame(step); }
      else el.textContent = "";
    })();
  }

  function buildFlips(str) {
    caption.innerHTML = "";
    caption.classList.add("caption-mask", "caption-restart");
    const us = [];
    for (const ch of str) {
      const s = document.createElement("span");
      s.className = "flip is-up";
      s.textContent = ch === " " ? NBSP : ch;
      caption.appendChild(s);
      us.push(s);
    }
    return us;
  }
  function showRestart(delayMs) {
    setTimeout(() => {
      caption.innerHTML = "";
      caption.classList.remove("caption-mask");
      caption.classList.add("caption-restart");
      caption.style.transition = "opacity 0.5s ease";
      caption.style.opacity = "0";
      scrambleInto(caption, "Press the spacebar to restart.");
      requestAnimationFrame(() => { caption.style.opacity = "1"; });
    }, delayMs);
  }
  function scrambleInto(el, text) {
    if (!el) return;
    if (reduce) { el.textContent = text; return; }
    const items = text.split("").map((ch) => ({
      ch, space: ch === " ",
      end: 10 + Math.floor(Math.random() * 34),
      c: "",
    }));
    let f = 0;
    (function step() {
      let out = "", done = 0;
      for (const it of items) {
        if (f >= it.end) { done++; out += it.ch; }
        else if (it.space) out += " ";
        else {
          if (!it.c || Math.random() < 0.35) it.c = CHARS[Math.floor(Math.random() * CHARS.length)];
          out += it.c;
        }
      }
      el.textContent = out;
      if (done < items.length) { f++; requestAnimationFrame(step); }
      else el.textContent = text;
    })();
  }

  function captionStatus(text, doScramble) {
    if (!caption) return null;
    const iconEl = caption.querySelector(".hero__caption-icon");
    caption.innerHTML = "";
    caption.style.display = "inline-flex";
    caption.style.alignItems = "center";
    caption.style.gap = "8px";
    if (iconEl) caption.appendChild(iconEl);
    const textEl = document.createElement("span");
    caption.appendChild(textEl);
    if (doScramble) scrambleInto(textEl, text);
    else textEl.textContent = text;
    return textEl;
  }
  function flipAway(el) {
    const cnt = el.querySelector(".hero__count");
    if (cnt) cnt.remove();
    const text = (el.textContent || "").trim();
    el.textContent = "";
    el.classList.add("caption-mask");
    const us = [];
    for (const ch of text) {
      const s = document.createElement("span");
      s.className = "flip";
      s.textContent = ch === " " ? NBSP : ch;
      el.appendChild(s);
      us.push(s);
    }
    shuffle(us.slice()).forEach((u, i) => (u.style.transitionDelay = i * 0.045 + "s"));
    requestAnimationFrame(() => us.forEach((u) => u.classList.add("is-down")));
  }

  function run() {
    if (finished) return;
    finished = true;
    hero.classList.add("is-favorited");
    const footer = hero.closest(".footer");
    if (footer) footer.classList.add("is-inverted");
    const sides = Array.from(hero.querySelectorAll(".hero__side"));
    const remaining = hero.querySelector(".hero__remaining");
    const subhead = hero.querySelector(".hero__subhead");
    if (reduce) {
      headline.textContent = "";
      if (subhead) subhead.textContent = "";
      captionStatus("Results are in!", false);
      sides.forEach((s) => (s.style.display = "none"));
      if (remaining) remaining.style.display = "none";
      return;
    }
    scrambleAway(headline);
    scrambleAway(subhead);
    sides.forEach(flipAway);
    if (remaining) flipAway(remaining);
    const statusEl = captionStatus("Testing your taste", true);
    if (statusEl) {
      setTimeout(() => { if (finished) scrambleInto(statusEl, "Results are in!"); }, RESULTS_DELAY);
    }
  }

  function init() {
    headline = hero.querySelector(".hero__headline");
    caption = hero.querySelector(".hero__caption");
    if (!headline || !caption) return;
    hlBase = headline.textContent;
    units = [];
    const icon = caption.querySelector(".hero__caption-icon");
    const text = (caption.textContent || "").replace(/\s+/g, " ").trim();
    caption.textContent = "";
    caption.classList.add("caption-mask");
    if (icon) {
      const w = document.createElement("span");
      w.className = "flip flip--icon";
      w.appendChild(icon);
      caption.appendChild(w);
      units.push(w);
    }
    for (const ch of text) {
      const s = document.createElement("span");
      s.className = "flip";
      s.textContent = ch === " " ? NBSP : ch;
      caption.appendChild(s);
      units.push(s);
    }
    frame = 0; queue = [];
    cancelAnimationFrame(raf);
    document.addEventListener("taste:favorited", run, { once: true });
  }

  function resetAll() {
    cancelAnimationFrame(raf);
    finished = false;
    hero.classList.remove("is-favorited");
    const footer = hero.closest(".footer");
    if (footer) footer.classList.remove("is-inverted");
    hero.innerHTML = heroHTML;
    init();
  }

  function doRestart() {
    finished = false;
    const footer = hero.closest(".footer");
    if (footer) footer.classList.add("is-restarting");
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent("taste:reset"));
      resetAll();
      if (footer) footer.classList.remove("is-restarting");
    }, 480);
  }

  window.addEventListener("keydown", (e) => {
    if ((e.code === "Space" || e.key === " ") && finished) {
      e.preventDefault();
      doRestart();
    }
  });

  init();
})();

