import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps Palmer source motion as a first-class component contract", async () => {
  const [packageJson, page, canvas, focus, motion, styles] = await Promise.all([
    read("package.json"),
    read("src/pages/PalmerHomePage.jsx"),
    read("src/sections/ExperienceCanvasSection.jsx"),
    read("src/composites/CollectionFocus.jsx"),
    read("src/motion/palmerMotion.js"),
    read("src/styles.css"),
  ]);

  assert.match(packageJson, /"gsap"/);
  assert.doesNotMatch(page, /ViewToggle|CollectionGridSection|setPageView|is-view-transitioning/);
  assert.match(canvas, /Draggable\.create\(canvas/);
  assert.match(canvas, /inertia: !prefersReducedMotion\(\)/);
  assert.match(canvas, /throwResistance/);
  assert.match(canvas, /edgeResistance: palmerMotion\.drag\.edgeResistance/);
  assert.match(canvas, /onThrowUpdate\(\)/);
  assert.match(canvas, /onThrowComplete\(\)/);
  assert.match(canvas, /palmerMotion\.zoom\.duration/);
  assert.match(canvas, /proximityThreshold/);
  assert.match(canvas, /focalPosition/);
  assert.match(focus, /collection-focus__product/);
  assert.match(focus, /carouselTrackRef/);
  assert.match(focus, /easeFactor = 0\.1 \/ \(distance \* 1\.75\)/);
  assert.match(focus, /markeeStep = 0\.1 \/ \(distance \* 0\.75\)/);
  assert.match(focus, /thumbTrack\.scrollHeight - \(thumbViewport\?\.clientHeight \?\? 0\)/);
  assert.match(focus, /indicatorTarget = activeOffset - railTarget/);
  assert.match(focus, /thumbViewport\.scrollTop = 0/);
  assert.match(focus, /stagger: duration\(palmerMotion\.focus\.contextStagger\)/);
  assert.match(focus, /collection-focus__title-line/);
  assert.match(focus, /palmerMotion\.focus\.titleDuration/);
  assert.match(focus, /ease: "expo\.inOut"/);
  assert.match(focus, /requestAnimationFrame\(\(\) => \{[\s\S]*requestAnimationFrame/);
  assert.match(focus, /is-category/);
  assert.match(focus, /onPointerMove/);
  assert.match(focus, /switchTo\(target, \{ force: true \}\)/);
  assert.match(focus, /onPointerDown=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(focus, /thumbIndicatorRef/);
  assert.match(focus, /onWheel=/);
  assert.match(focus, /wheelSnapDelay/);
  assert.match(focus, /handleOutsidePress/);
  assert.match(focus, /usesSourcePortraitTouchMotion/);
  assert.match(focus, /closeOffset.*"-100vw".*"-60vw"/);
  assert.match(focus, /duration: duration\(1\.5\)[\s\S]*ease: "expo\.inOut"/);
  assert.match(focus, /\.set\(imageRef\.current, \{ display: "none" \}, 0\.9\)/);
  assert.match(focus, /duration: duration\(0\.5\)[\s\S]*ease: "back\.out"/);
  assert.match(focus, /timeline\.call\(onClose, \[\], 2\)/);
  assert.match(motion, /zoomDelay: 2/);
  assert.match(motion, /zoomDuration: 2/);
  assert.match(motion, /controlsAt: 3\.5/);
  assert.match(motion, /titleDuration: 1/);
  assert.match(motion, /titleStagger: 0\.05/);
  assert.match(motion, /desktopThrowResistance: 8000/);
  assert.match(motion, /portraitTouchThrowResistance: 1000/);
  assert.match(motion, /edgeResistance: 0\.9/);
  assert.match(styles, /experience-canvas\.drag-easing[^}]*transform \.2s cubic-bezier\(\.33, 1, \.68, 1\)/);
  assert.match(styles, /experience-canvas\.drag-easing[^}]*transition-duration: \.6s/);
  assert.match(styles, /collection-focus__carousel[^}]*height: 40vw;[^}]*overflow: hidden/);
  assert.match(styles, /\.product-image \{[^}]*width: 42%;[^}]*height: 42%;[^}]*aspect-ratio: 1;[^}]*border-radius: 20%/);
  assert.match(styles, /collection-focus__product \.product-image \{ width: 42%; height: 42%; \}/);
  assert.match(styles, /collection-focus__context-char\.is-category \{ font-size: 1\.5em; font-weight: 500/);
  assert.match(styles, /collection-focus__title-line \{[^}]*overflow: hidden/);
  assert.doesNotMatch(canvas, /visualScale/);
  assert.doesNotMatch(focus, /visualScale/);
});
