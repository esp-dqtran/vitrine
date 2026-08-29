import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MoveRight, X } from "../primitives/Icons";
import { duration, gsap, palmerMotion, prefersReducedMotion } from "../motion/palmerMotion";
import { BrandLogo } from "../primitives/BrandLogo";
import { ProductImage } from "../primitives/ProductImage";
import { ControlButton } from "../primitives/ControlButton";

function usesSourcePortraitTouchMotion() {
  const userAgent = window.navigator?.userAgent ?? "";
  const isTouchDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
    || "ontouchstart" in window;
  return isTouchDevice && !window.matchMedia("(orientation: landscape)").matches;
}

function platformLabel(platform) {
  if (platform === "ios") return "iOS";
  if (platform === "android") return "Android";
  if (platform === "web") return "Web";
  return platform;
}

function capturedDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function CollectionFocus({ collection, initialProduct, onClose, onOpenApp }) {
  const products = useMemo(() => {
    const selected = collection.products.find((product) => product.id === initialProduct?.id);
    return selected
      ? [selected, ...collection.products.filter((product) => product.localImage !== selected.localImage)]
      : collection.products;
  }, [collection.products, initialProduct?.localImage]);
  const [slide, setSlide] = useState(0);
  const [contextProduct, setContextProduct] = useState(products[0]);
  const rootRef = useRef(null);
  const paperRef = useRef(null);
  const titleRef = useRef(null);
  const imageRef = useRef(null);
  const carouselTrackRef = useRef(null);
  const thumbsViewportRef = useRef(null);
  const thumbsTrackRef = useRef(null);
  const thumbIndicatorRef = useRef(null);
  const contextRef = useRef(null);
  const closeRef = useRef(null);
  const ctaRef = useRef(null);
  const closing = useRef(false);
  const plateRaf = useRef(null);
  const currentScroll = useRef(0);
  const markeeScroll = useRef(0);
  const currentIndicator = useRef(0);
  const contextTimer = useRef(null);
  const contextTween = useRef(null);
  const wheelTimer = useRef(null);
  const wheelDirection = useRef(0);
  const dragState = useRef(null);
  const suppressProductClick = useRef(false);

  useLayoutEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    const scope = gsap.context(() => {
      const finalRect = imageRef.current.getBoundingClientRect();
      const originRect = initialProduct?.originRect ?? finalRect;
      const experienceOrigin = document.querySelector(".experience-origin");
      const experienceStage = document.querySelector(".experience-stage");
      const experienceControls = document.querySelectorAll(".control-dock, .drag-hint, .zoom-control");
      const originProduct = initialProduct?.originKey
        ? document.querySelector(`[data-product-key="${initialProduct.originKey}"] .product-image`)
        : null;
      const originTransform = {
        x: originRect.x - finalRect.x,
        y: originRect.y - finalRect.y,
        scale: originRect.width / finalRect.width,
        transformOrigin: "top left",
      };
      const openOffset = usesSourcePortraitTouchMotion() ? "100vw" : "60vw";

      if (originProduct) gsap.set(originProduct, { autoAlpha: 0 });
      if (experienceStage) gsap.set(experienceStage, { pointerEvents: "none" });

      gsap.timeline()
        .fromTo(paperRef.current, { width: 0 }, {
          width: "100%",
          duration: duration(1.4),
          ease: "power1.inOut",
        }, 0)
        .to(experienceOrigin, {
          x: openOffset,
          duration: duration(1.4),
          ease: "power1.inOut",
        }, 0)
        .to(experienceControls, {
          autoAlpha: 0,
          duration: duration(0.45),
          ease: "power1.out",
        }, 0)
        .set(titleRef.current, { autoAlpha: 0 }, 0)
        .set(".collection-focus__title-char", { yPercent: 115, force3D: true }, 0)
        .set(titleRef.current, { autoAlpha: 1 }, 0.5)
        .to(".collection-focus__title-char", {
          yPercent: 0,
          duration: duration(palmerMotion.focus.titleDuration),
          ease: "expo.inOut",
          stagger: duration(palmerMotion.focus.titleStagger),
          force3D: true,
          clearProps: "transform",
        }, 0.5)
        .fromTo(imageRef.current, { ...originTransform, autoAlpha: 1 }, {
          x: 0,
          y: 0,
          scale: 1,
          autoAlpha: 1,
          duration: duration(1.4),
          ease: "power1.out",
        }, 0)
        .fromTo(".collection-focus__thumbs, .collection-focus__context, .collection-focus__close", {
          autoAlpha: 0,
        }, {
          autoAlpha: 1,
          duration: duration(0.55),
          ease: "power2.out",
          stagger: 0.04,
        }, 1.35)
        .fromTo(".collection-focus__cta", { autoAlpha: 0 }, {
          autoAlpha: 1,
          duration: duration(0.3),
          ease: "power2.out",
        }, 1.65);
    }, rootRef);
    return () => scope.revert();
  }, [collection.name]);

  useEffect(() => () => {
    cancelAnimationFrame(plateRaf.current);
    clearTimeout(contextTimer.current);
    clearTimeout(wheelTimer.current);
    contextTween.current?.kill();
  }, []);

  const animateContext = (index) => {
    clearTimeout(contextTimer.current);
    contextTween.current?.kill();
    contextTimer.current = setTimeout(() => {
      const oldTitleChars = rootRef.current?.querySelectorAll(".collection-focus__title-char");
      const oldContextChars = rootRef.current?.querySelectorAll(
        ".collection-focus__context-char, .collection-focus__context-detail",
      );
      contextTween.current = gsap.timeline({
        onComplete: () => {
          setContextProduct(products[index]);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const newTitleChars = rootRef.current?.querySelectorAll(".collection-focus__title-char");
              const newContextChars = rootRef.current?.querySelectorAll(
                ".collection-focus__context-char, .collection-focus__context-detail",
              );
              gsap.set(titleRef.current, { autoAlpha: 0 });
              gsap.set(newTitleChars, { yPercent: 115, autoAlpha: 1, force3D: true });
              gsap.set(newContextChars, { yPercent: 100, autoAlpha: 0, force3D: true });
              gsap.set(titleRef.current, { autoAlpha: 1 });
              contextTween.current = gsap.timeline()
                .to(newTitleChars, {
                  yPercent: 0,
                  duration: duration(palmerMotion.focus.titleDuration),
                  ease: "expo.inOut",
                  stagger: duration(palmerMotion.focus.titleStagger),
                  force3D: true,
                  clearProps: "transform,opacity,visibility",
                }, 0)
                .to(newContextChars, {
                  yPercent: 0,
                  autoAlpha: 1,
                  duration: duration(palmerMotion.focus.contextDuration),
                  ease: "cubic.inOut",
                  stagger: duration(palmerMotion.focus.contextStagger),
                  force3D: true,
                  clearProps: "transform,opacity,visibility",
                }, 0.15);
            });
          });
        },
      })
        .to(oldTitleChars, {
          yPercent: -115,
          autoAlpha: 0,
          duration: duration(0.4),
          ease: "cubic.inOut",
          stagger: duration(0.015),
          force3D: true,
        }, 0)
        .to(oldContextChars, {
          yPercent: -100,
          autoAlpha: 0,
          duration: duration(palmerMotion.focus.contextDuration),
          ease: "cubic.inOut",
          stagger: duration(palmerMotion.focus.contextStagger),
          force3D: true,
        }, 0);
    }, palmerMotion.focus.contextDelay * 1000);
  };

  const updateThumbRail = (slideProgress) => {
    const thumbTrack = thumbsTrackRef.current;
    const thumbViewport = thumbsViewportRef.current;
    const firstThumb = thumbTrack?.querySelector("button");
    const secondThumb = thumbTrack?.querySelector("button:nth-of-type(2)");
    if (!thumbTrack || !firstThumb) return;
    if (thumbViewport) thumbViewport.scrollTop = 0;
    const thumbStride = (secondThumb?.offsetTop ?? firstThumb.getBoundingClientRect().height) - firstThumb.offsetTop;
    const activeOffset = Math.max(0, Math.min(products.length - 1, slideProgress)) * thumbStride;
    const railLimit = Math.max(0, thumbTrack.scrollHeight - (thumbViewport?.clientHeight ?? 0));
    markeeScroll.current = Math.min(activeOffset, railLimit);
    currentIndicator.current = activeOffset - markeeScroll.current;
    gsap.set(thumbTrack, { y: -markeeScroll.current });
    gsap.set(thumbIndicatorRef.current, { y: currentIndicator.current });
  };

  const switchTo = (index, { force = false } = {}) => {
    if (closing.current || (!force && index === slide)) return;
    const next = Math.max(0, Math.min(products.length - 1, index));
    const hasChanged = next !== slide;
    const distance = Math.max(1, Math.abs(next - slide));
    const itemHeight = imageRef.current?.getBoundingClientRect().height || window.innerWidth * 0.4;
    const targetScroll = itemHeight * next;
    const thumbTrack = thumbsTrackRef.current;
    const thumbViewport = thumbsViewportRef.current;
    const firstThumb = thumbTrack?.querySelector("button");
    const secondThumb = thumbTrack?.querySelector("button:nth-of-type(2)");
    if (thumbViewport) thumbViewport.scrollTop = 0;
    const thumbStride = firstThumb
      ? (secondThumb?.offsetTop ?? firstThumb.getBoundingClientRect().height) - firstThumb.offsetTop
      : 0;
    const railLimit = thumbTrack && firstThumb
      ? Math.max(0, thumbTrack.scrollHeight - (thumbViewport?.clientHeight ?? 0))
      : 0;
    const activeOffset = thumbStride * next;
    const railTarget = Math.min(activeOffset, railLimit);
    const indicatorTarget = activeOffset - railTarget;
    const easeFactor = 0.1 / (distance * 1.75);
    const easedStep = 1 - Math.pow(1 - easeFactor, 3);
    const markeeStep = 0.1 / (distance * 0.75);

    cancelAnimationFrame(plateRaf.current);
    if (hasChanged) {
      setSlide(next);
      animateContext(next);
    }

    const tick = () => {
      currentScroll.current += (targetScroll - currentScroll.current) * easedStep;
      markeeScroll.current += (railTarget - markeeScroll.current) * markeeStep;
      currentIndicator.current += (indicatorTarget - currentIndicator.current) * markeeStep;
      gsap.set(carouselTrackRef.current, { y: -currentScroll.current });
      gsap.set(thumbsTrackRef.current, { y: -markeeScroll.current });
      gsap.set(thumbIndicatorRef.current, { y: currentIndicator.current });
      if (
        Math.abs(targetScroll - currentScroll.current) > 0.01
        || Math.abs(railTarget - markeeScroll.current) > 0.01
        || Math.abs(indicatorTarget - currentIndicator.current) > 0.01
      ) {
        plateRaf.current = requestAnimationFrame(tick);
      }
    };

    if (prefersReducedMotion()) {
      currentScroll.current = targetScroll;
      markeeScroll.current = railTarget;
      currentIndicator.current = indicatorTarget;
      gsap.set(carouselTrackRef.current, { y: -targetScroll });
      gsap.set(thumbsTrackRef.current, { y: -railTarget });
      gsap.set(thumbIndicatorRef.current, { y: indicatorTarget });
    } else {
      plateRaf.current = requestAnimationFrame(tick);
    }
  };

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    cancelAnimationFrame(plateRaf.current);
    clearTimeout(contextTimer.current);
    clearTimeout(wheelTimer.current);
    contextTween.current?.kill();
    const originProduct = initialProduct?.originKey
      ? document.querySelector(`[data-product-key="${initialProduct.originKey}"] .product-image`)
      : null;
    const experienceStage = document.querySelector(".experience-stage");
    const closeOffset = usesSourcePortraitTouchMotion() ? "-100vw" : "-60vw";
    const focusLayers = rootRef.current.querySelectorAll(
      ".collection-focus__panel > :not(.collection-focus__paper), .collection-focus__cta, .collection-focus__close, .collection-focus__mobile-band",
    );
    const mobileBand = rootRef.current.querySelector(".collection-focus__mobile-band");
    const timeline = gsap.timeline();

    // Source closeFocus(): the focus layer and experience counter-slide for
    // 1.5s. The selected source image is restored to its original card at
    // 0.9s, then springs from scale 0 at 1s instead of FLIP-reversing.
    timeline
      .to(focusLayers, {
        x: closeOffset,
        duration: duration(1.5),
        ease: "expo.inOut",
      }, 0)
      .to(paperRef.current, {
        width: 0,
        duration: duration(1.5),
        ease: "expo.inOut",
      }, 0)
      .to(".experience-origin", {
        x: 0,
        duration: duration(1.5),
        ease: "expo.inOut",
      }, 0)
      .to(closeRef.current, {
        scale: 0,
        duration: duration(0.5),
        ease: "back.in",
        pointerEvents: "none",
      }, 0)
      // Re-parenting removes the first carousel child at 0.9s, exposing the
      // next cloned collection image until the carousel clears at 1s.
      .set(imageRef.current, { display: "none" }, 0.9)
      .set(".collection-focus__title, .collection-focus__thumbs, .collection-focus__context", {
        autoAlpha: 0,
      }, 1)
      .to([ctaRef.current, mobileBand], {
        autoAlpha: 0,
        pointerEvents: "none",
        duration: duration(0.5),
      }, 1)
      .to(".control-dock, .drag-hint, .zoom-control", {
        autoAlpha: 1,
        duration: duration(0.5),
        ease: "power1.inOut",
        pointerEvents: "all",
      }, 1)
      .set(experienceStage, { pointerEvents: "all" }, 1.9);

    if (originProduct) {
      timeline
        .set(originProduct, {
          autoAlpha: 1,
          scale: 0,
          transformOrigin: "50% 50%",
        }, 0.9)
        .to(originProduct, {
          scale: 1,
          duration: duration(0.5),
          ease: "back.out",
        }, 1);
    }

    timeline.call(onClose, [], 2);
  };

  useEffect(() => {
    const handleOutsidePress = (event) => {
      if (closing.current || rootRef.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener("mousedown", handleOutsidePress);
    return () => document.removeEventListener("mousedown", handleOutsidePress);
  });

  const move = (step) => switchTo(Math.max(0, Math.min(products.length - 1, slide + step)));

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowDown" || event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <section
      ref={rootRef}
      className="collection-focus"
      role="dialog"
      aria-modal="true"
      aria-label={`${contextProduct.name} app`}
      tabIndex={-1}
      onWheel={(event) => {
        if (usesSourcePortraitTouchMotion() || closing.current) return;
        event.preventDefault();
        cancelAnimationFrame(plateRaf.current);
        const itemHeight = imageRef.current?.getBoundingClientRect().height || window.innerWidth * 0.4;
        const maxScroll = itemHeight * (products.length - 1);
        currentScroll.current = Math.max(0, Math.min(maxScroll, currentScroll.current + event.deltaY));
        wheelDirection.current = Math.sign(event.deltaY);
        gsap.set(carouselTrackRef.current, { y: -currentScroll.current });
        updateThumbRail(currentScroll.current / itemHeight);
        clearTimeout(wheelTimer.current);
        wheelTimer.current = setTimeout(() => {
          const progress = currentScroll.current / itemHeight;
          const target = wheelDirection.current > 0 ? Math.ceil(progress) : Math.floor(progress);
          switchTo(target, { force: true });
        }, palmerMotion.focus.wheelSnapDelay * 1000);
      }}
    >
      <div className="collection-focus__panel">
        <div ref={paperRef} className="collection-focus__paper" aria-hidden="true" />
        <BrandLogo className="collection-focus__logo" />
        <h2 ref={titleRef} className="collection-focus__title">
          <span className="collection-focus__title-line">
            {[...contextProduct.name].map((character, index) => (
              <span className="collection-focus__title-char" key={`${contextProduct.id}-${character}-${index}`}>
                {character === " " ? "\u00a0" : character}
              </span>
            ))}
          </span>
        </h2>
        <div
          className="collection-focus__carousel"
          onPointerDown={(event) => {
            cancelAnimationFrame(plateRaf.current);
            suppressProductClick.current = false;
            dragState.current = {
              y: event.clientY,
              slide,
              scroll: currentScroll.current,
              itemHeight: imageRef.current?.getBoundingClientRect().height || window.innerWidth * 0.4,
              moved: false,
            };
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragState.current;
            if (!drag) return;
            if (Math.abs(event.clientY - drag.y) > 6) drag.moved = true;
            const maxScroll = drag.itemHeight * (products.length - 1);
            const rawScroll = drag.scroll - (event.clientY - drag.y);
            currentScroll.current = Math.max(0, Math.min(maxScroll, rawScroll));
            gsap.set(carouselTrackRef.current, { y: -currentScroll.current });

            updateThumbRail(currentScroll.current / drag.itemHeight);
          }}
          onPointerUp={(event) => {
            const drag = dragState.current;
            dragState.current = null;
            if (!drag) return;
            suppressProductClick.current = drag.moved;
            if (drag.moved) {
              requestAnimationFrame(() => {
                suppressProductClick.current = false;
              });
            }
            const delta = event.clientY - drag.y;
            const target = Math.abs(delta) > 24
              ? drag.slide + (delta < 0 ? 1 : -1)
              : drag.slide;
            switchTo(target, { force: true });
          }}
          onPointerCancel={() => {
            const drag = dragState.current;
            dragState.current = null;
            if (drag) switchTo(drag.slide, { force: true });
          }}
        >
          <div ref={carouselTrackRef} className="collection-focus__carousel-track">
            {products.map((product, index) => (
              <a
                ref={index === 0 ? imageRef : undefined}
                className="collection-focus__product"
                key={`${product.index}-${product.localImage}`}
                href={product.appUrl}
                aria-label={`View ${product.name}`}
                aria-hidden={index !== slide}
                tabIndex={index === slide ? 0 : -1}
                onClick={(event) => {
                  if (suppressProductClick.current) {
                    suppressProductClick.current = false;
                    event.preventDefault();
                    return;
                  }
                  if (onOpenApp) {
                    event.preventDefault();
                    onOpenApp(product.id);
                  }
                }}
              >
                <ProductImage item={product} eager />
              </a>
            ))}
          </div>
        </div>
        <div ref={thumbsViewportRef} className="collection-focus__thumbs" aria-label="Vitrines apps">
          <div ref={thumbsTrackRef} className="collection-focus__thumbs-track">
            {products.map((product, index) => (
              <button
                type="button"
                key={`${product.index}-${product.name}-${index}`}
                aria-label={product.name}
                aria-current={index === slide ? "true" : undefined}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => switchTo(index)}
              >
                <ProductImage item={product} eager />
              </button>
            ))}
          </div>
          <span ref={thumbIndicatorRef} className="collection-focus__thumb-indicator" aria-hidden="true" />
        </div>
        <div ref={contextRef} className="collection-focus__context">
          <p className="collection-focus__context-summary">
            {[...`${contextProduct.type} · ${contextProduct.totalScreens.toLocaleString()} screens`].map((character, index) => (
              <span
                className={`collection-focus__context-char ${index < contextProduct.type.length ? "is-category" : ""}`.trim()}
                key={`${character}-${index}`}
              >
                {character === " " ? "\u00a0" : character}
              </span>
            ))}
          </p>
          {contextProduct.description && (
            <p className="collection-focus__description collection-focus__context-detail">
              {contextProduct.description}
            </p>
          )}
          <dl className="collection-focus__facts collection-focus__context-detail" aria-label={`${contextProduct.name} details`}>
            {contextProduct.platforms?.length > 0 && (
              <div>
                <dt>Platforms</dt>
                <dd>{contextProduct.platforms.map(platformLabel).join(", ")}</dd>
              </div>
            )}
            {Number.isFinite(contextProduct.analyzedScreens) && contextProduct.analyzedScreens > 0 && (
              <div>
                <dt>Analyzed</dt>
                <dd>{contextProduct.analyzedScreens.toLocaleString()} screens</dd>
              </div>
            )}
            {capturedDate(contextProduct.lastCapturedAt) && (
              <div>
                <dt>Captured</dt>
                <dd>{capturedDate(contextProduct.lastCapturedAt)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
      <div className="collection-focus__mobile-band" aria-hidden="true" />
      <a
        ref={ctaRef}
        className="collection-focus__cta"
        href={contextProduct.appUrl}
        onClick={onOpenApp ? (event) => {
          event.preventDefault();
          onOpenApp(contextProduct.id);
        } : undefined}
      >
        <span className="collection-focus__cta-label">view app</span>
        <span className="collection-focus__cta-arrow"><MoveRight size={15} /></span>
      </a>
      <ControlButton ref={closeRef} className="collection-focus__close" icon={<X size={18} />} aria-label="Close app" onClick={close} />
    </section>
  );
}
