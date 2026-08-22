import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_TILES = [
  '0f76a459fdec8ae13af949e3fb865c57137a4f85.png',
  '276c135b4254309c274010e0361414d09395c2ee.png',
  '2d0dfffdec136b2454ff060456a207b80e19d863.png',
  '422bd6299cb4ef1494c2813aa0acdd6739346d10.png',
  '435ef17f31a8b8818eca668ef21c807aed729aa2.png',
  '46fc3bf6d901c97c2566930f4ee9621a73c483d7.jpg',
  '4ccd30439df99379dcfe655af0bd1e8d3d2940ff.png',
  '521baef0b44c6a08d64244dc9bc16c9e55e63f71.png',
  '638fd8e8773dcc799b28de7c623e8f7662556840.jpg',
  '6527e06483138d050995ea1f8dd6b650bf0a050a.png',
  '751c027fd08529f057e201c04de5822dda5c92bb.png',
];

function desktopHome(index) {
  if (index < 6) return { x: (index - 2.5) * 105, y: 41.6 };
  return { x: (index - 8) * 105, y: -41.6 };
}

function mobileHome(index) {
  if (index < 2) return { x: (index - 0.5) * 105, y: -83.2 };
  if (index < 5) return { x: (index - 3) * 105, y: 0 };
  return { x: (index - 5.5) * 105, y: 83.2 };
}

export function TasteSwipeFooter({ tileUrls }) {
  const urls = tileUrls ?? DEFAULT_TILES.map((name) => `/assets/footer/${name}`);
  const stageRef = useRef(null);
  const [mobile, setMobile] = useState(false);
  const [decisions, setDecisions] = useState([]);
  const [drag, setDrag] = useState(null);
  const tiles = useMemo(() => urls.slice(0, mobile ? 7 : 11), [mobile, urls]);
  const yesCount = decisions.filter((item) => item.direction === 'yes').length;
  const finished = yesCount >= 4;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 480px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  function releaseDrag(event) {
    if (!drag || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const direction = x < rect.width * 0.4 ? 'yes' : x > rect.width * 0.6 ? 'no' : null;
    if (direction) setDecisions((items) => [...items, { slot: drag.index, direction }]);
    setDrag(null);
  }

  function restart() {
    setDecisions([]);
    setDrag(null);
  }

  return (
    <footer className={`taste-swipe${finished ? ' is-finished' : ''}`} aria-label="Taste swipe game">
      <div
        ref={stageRef}
        className="taste-swipe__stage"
        onPointerMove={(event) => {
          if (!drag) return;
          setDrag((state) => ({ ...state, x: event.clientX - state.startX, y: event.clientY - state.startY }));
        }}
        onPointerUp={releaseDrag}
        onPointerCancel={() => setDrag(null)}
      >
        <div className="taste-swipe__caption"><span aria-hidden="true">→</span> Drag a tile</div>
        <div className="taste-swipe__heading">
          <h2>{finished ? 'Results are in!' : 'Swipe Yes Or No.'}</h2>
          <p>{finished ? 'Your favorites are taking shape.' : 'Play favorites.'}</p>
        </div>
        <span className="taste-swipe__side taste-swipe__side--yes">Love it <small>{String(Math.max(0, 4 - yesCount)).padStart(2, '0')}</small></span>
        <span className="taste-swipe__side taste-swipe__side--no">Hmm, not so much</span>
        <div className="taste-swipe__deck" aria-live="polite">
          {finished ? (
            <button className="taste-swipe__restart" type="button" onClick={restart}>Press to restart</button>
          ) : (
            tiles.map((src, index) => {
              const home = mobile ? mobileHome(index) : desktopHome(index);
              const isDragging = drag?.index === index;
              return (
                <img
                  key={src}
                  src={src}
                  alt=""
                  draggable={false}
                  className={`taste-swipe__tile${isDragging ? ' is-dragging' : ''}`}
                  style={{
                    zIndex: isDragging ? 30 : index + 1,
                    transform: isDragging
                      ? `translate3d(calc(${home.x}% + ${drag.x}px), calc(${home.y}% + ${drag.y}px), 0) scale(1.06)`
                      : `translate3d(${home.x}%, ${home.y}%, 0)`,
                  }}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    setDrag({ index, startX: event.clientX, startY: event.clientY, x: 0, y: 0 });
                  }}
                  onPointerUp={releaseDrag}
                  onPointerCancel={() => setDrag(null)}
                />
              );
            })
          )}
        </div>
      </div>
    </footer>
  );
}
