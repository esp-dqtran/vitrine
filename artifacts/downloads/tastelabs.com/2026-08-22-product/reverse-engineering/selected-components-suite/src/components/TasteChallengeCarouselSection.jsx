import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_IMAGES = [
  '6a50cb1142b609298bb2d75d_448c933e9deebbb2156d4ae1d58d188c_Frame%201171280140.avif',
  '6a50cb117f04b11c29aea486_ab1e2f502f4f5a9711ee55518b286ae9_Frame%201171280141.avif',
  '6a50cb117fba4e209a4c71ea_4aa8e137ef5595f1cdfce591c930ae61_Frame%201171280139.avif',
  '6a50cb1142b609298bb2d74b_093da6815205c58ef56f0fb47c1e9da8_Frame%201171280138.avif',
  '6a50cb119b397fb853e34b86_de05d9ebd3cc9297bd79ca13f63bbd86_Frame%201171280137.avif',
  '6a50cb112dd15c70d1860836_ee4e1d2628004fdd3fa05ce3cfacfdb4_Frame%201171280131.png',
  '6a50cb11f8dc9bd6d894b70b_32646e38172599d705d461d760c24fbe_Frame%201171280132.avif',
  '6a50cb115e1240f3d257f84b_3348cbd99d403a1c72c8cbc60dca1305_Frame%201171280136.avif',
  '6a50cb11dd8c37dcbb6096e9_05124003ce29eb0bf8befdc97f0f1022_Frame%201171280129.avif',
  '6a50cb115840e0a456bc0585_feb11ca417d753006dc7d42ee9318870_Frame%201171280125.avif',
  '6a50cb115840e0a456bc0580_c0dbb93828d225013217535c8d8cc21e_Frame%201171280128.avif',
  '6a50cb1183ddf2489b3d7bc7_eb46a89d20bcb0ee031b78603fb13fcf_Frame%201171280130.avif',
  '6a50cb11f6ced96c53b657a3_75682d69f3a3d4e3e22f88e05d5f8d56_Frame%201171280124.avif',
  '6a50cb11ed08fd2374bab01a_e9cd5a7ed19bdca4330eb67fde5539c6_Frame%201171280126.avif',
  '6a50cb112fd9144b363a0127_867efbcb282ef55777e85f117637cfcb_Frame%201171280135.avif',
  '6a50cb1152b12491ba980add_7c4f21fea80a1e9bcff4b3226dee3e7d_Frame%201171280127.avif',
  '6a50d22a42b609298bb7780d_Frame%201171280059.avif',
  '6a50d22a6627c349e8613fca_Frame%201171280142.avif',
];

const PANEL_COUNTS = [2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1];

function groupPanels(urls) {
  let cursor = 0;
  return PANEL_COUNTS.map((count) => {
    const panel = urls.slice(cursor, cursor + count);
    cursor += count;
    return panel;
  });
}

export function TasteChallengeCarouselSection({ imageUrls }) {
  const urls = imageUrls ?? DEFAULT_IMAGES.map((name) => `/assets/challenge/${name}`);
  const panels = useMemo(() => groupPanels(urls), [urls]);
  const carouselRef = useRef(null);
  const rotationRef = useRef(10);
  const dragRef = useRef(null);
  const [rotation, setRotation] = useState(10);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const tick = (now) => {
      const elapsed = Math.min(64, now - previous);
      previous = now;
      if (!dragRef.current) {
        rotationRef.current = (rotationRef.current + elapsed * 0.012) % 360;
        setRotation(rotationRef.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  function beginDrag(event) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      lastTime: performance.now(),
      lastX: event.clientX,
      startRotation: rotationRef.current,
      startX: event.clientX,
      velocity: 0,
    };
    setDragging(true);
  }

  function moveDrag(event) {
    const drag = dragRef.current;
    const carousel = carouselRef.current;
    if (!drag || !carousel) return;
    const now = performance.now();
    const deltaX = event.clientX - drag.lastX;
    const elapsed = Math.max(1, now - drag.lastTime);
    drag.velocity = deltaX / elapsed;
    drag.lastX = event.clientX;
    drag.lastTime = now;
    const dragDistance = carousel.getBoundingClientRect().width * 3;
    rotationRef.current = drag.startRotation + ((event.clientX - drag.startX) / dragDistance) * 360;
    setRotation(rotationRef.current);
  }

  function endDrag() {
    const drag = dragRef.current;
    if (drag && Math.abs(drag.velocity) > 0.03) {
      rotationRef.current += Math.sign(drag.velocity) * Math.min(16, Math.abs(drag.velocity) * 8);
      setRotation(rotationRef.current);
    }
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <section className={`taste-challenge${dragging ? ' is-dragging' : ''}`} aria-label="Taste challenge carousel">
      <div
        ref={carouselRef}
        className="taste-challenge__carousel"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {panels.map((panel, panelIndex) => (
          <div
            key={panelIndex}
            className="taste-challenge__panel"
            style={{ transform: `rotateY(${panelIndex * 30 + rotation}deg)` }}
          >
            {panel.map((src) => (
              <div className="taste-challenge__item" key={src}>
                <img className="taste-challenge__image" src={src} alt="" draggable={false} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="taste-challenge__copy taste-challenge__copy--desktop">
        <h2 className="taste-challenge__headline">
          AI has made it easy <span>to generate anything.</span><br />
          <span>The challenge is knowing what to make.</span><br />
          <span>And how to make it great.</span>
        </h2>
      </div>
      <div className="taste-challenge__copy taste-challenge__copy--mobile">
        <h2 className="taste-challenge__headline">
          AI has made it easy <span>to generate anything. The challenge is knowing what to make. And how to make it great.</span>
        </h2>
      </div>
    </section>
  );
}
