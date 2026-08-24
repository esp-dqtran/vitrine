import { useEffect, useRef, useState } from 'react';

const PHYSICS_ITEMS = [
  { kind: 'eye', x: 8, y: 26, size: 94, rotate: -8 },
  { kind: 'shape square green', x: 16, y: 37, size: 112, rotate: 12 },
  { kind: 'shape circle grid', x: 25, y: 23, size: 106, rotate: -14 },
  { kind: 'pill', label: '400K videos', x: 35, y: 34, rotate: 7 },
  { kind: 'pill', label: '5.8K movies', x: 47, y: 21, rotate: -11 },
  { kind: 'shape triangle grid', x: 58, y: 37, size: 124, rotate: 8 },
  { kind: 'eye', x: 68, y: 20, size: 106, rotate: 14 },
  { kind: 'pill', label: '150K animations', x: 78, y: 33, rotate: -9 },
  { kind: 'shape hexagon green', x: 89, y: 22, size: 118, rotate: 5 },
  { kind: 'pill orange', label: '1.5M stills', x: 14, y: 48, rotate: -8 },
  { kind: 'shape circle grid', x: 27, y: 52, size: 118, rotate: 6 },
  { kind: 'pill', label: '5.5K music videos', x: 42, y: 46, rotate: 9 },
  { kind: 'shape circle grid', x: 56, y: 55, size: 92, rotate: -7 },
  { kind: 'pill', label: '2K TV series', x: 67, y: 48, rotate: 8 },
  { kind: 'eye', x: 78, y: 52, size: 82, rotate: -10 },
  { kind: 'eye', x: 87, y: 48, size: 82, rotate: 11 },
  { kind: 'shape square yellow', x: 94, y: 52, size: 104, rotate: -6 },
  { kind: 'shape circle grid', x: 36, y: 68, size: 84, rotate: 11 },
  { kind: 'pill', label: '15K ads', x: 60, y: 66, rotate: -5 },
];

function Eye({ pointer }) {
  return (
    <span className="flim-physics-eye">
      <span className="flim-physics-eye__inner" style={{ transform: `translate(${pointer.x * 11}px, ${pointer.y * 8}px)` }}>
        <span className="flim-physics-eye__iris"><span className="flim-physics-eye__pupil" /><span className="flim-physics-eye__cross">+</span></span>
      </span>
    </span>
  );
}

function PhysicsItem({ item, index, pointer }) {
  const style = {
    '--flim-drop-delay': `${index * 65}ms`,
    '--flim-item-rotate': `${item.rotate}deg`,
    '--flim-item-size': `${(item.size ?? 126) * 1.5}px`,
    '--flim-item-x': `${item.x}%`,
    '--flim-item-y': `${item.y}%`,
  };
  if (item.kind === 'eye') return <span className="flim-physics-item is-eye" style={style}><Eye pointer={pointer} /></span>;
  if (item.kind.startsWith('pill')) return <span className={`flim-physics-item flim-physics-pill${item.kind.includes('orange') ? ' is-orange' : ''}`} style={style}>{item.label}</span>;
  if (item.kind.includes('hexagon')) {
    return (
      <span className="flim-physics-item flim-physics-shape is-hexagon is-green" style={style}>
        <svg aria-hidden="true" viewBox="0 0 374 324"><path d="M374 161.947L280.5 323.894H93.5L0 161.947L93.5 0L280.5 7.98702e-06L374 161.947Z" fill="currentColor" /></svg>
      </span>
    );
  }
  return <span className={`flim-physics-item flim-physics-shape is-${item.kind.split(' ')[1]} is-${item.kind.split(' ')[2]}`} style={style} />;
}

function SearchBar() {
  const [query, setQuery] = useState('');
  return (
    <form className="flim-search-bar flim-database-search" onSubmit={(event) => event.preventDefault()}>
      <label className="flim-search-bar__field">
        <span className="flim-sr-only">Search anything</span>
        <input aria-label="Search anything" onChange={(event) => setQuery(event.target.value)} placeholder="SEARCH ANYTHING" value={query} />
      </label>
      <button type="submit">SEARCH <span aria-hidden="true">⌘/</span></button>
    </form>
  );
}

export function FlimDatabaseScrollSection({
  headerUrl,
  mobileImagesUrl,
  platformImageUrl,
  previewMode = 'card',
  searchImageUrl,
}) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const [entered, setEntered] = useState(false);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const observer = new IntersectionObserver(([entry]) => setEntered(entry.isIntersecting), { threshold: .12 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (previewMode !== 'full') return undefined;
    let frame = 0;
    const update = () => {
      const root = rootRef.current;
      if (root) {
        const rect = root.getBoundingClientRect();
        const available = Math.max(1, rect.height - window.innerHeight);
        setProgress(Math.max(0, Math.min(1, -rect.top / available)));
      }
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [previewMode]);

  const trackProgress = previewMode === 'card' ? 0 : progress;

  return (
    <section
      className={`flim-component flim-database-scroll is-${previewMode}${entered ? ' is-entered' : ''}`}
      data-flim-component="database-scroll"
      ref={rootRef}
      style={{ '--flim-scroll-progress': trackProgress }}
    >
      <div className="flim-database-scroll__sticky" ref={stageRef}>
        <div className="flim-database-scroll__track">
          <article
            className="flim-database-panel"
            onPointerLeave={() => setPointer({ x: 0, y: 0 })}
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setPointer({
                x: ((event.clientX - rect.left) / rect.width - .5) * 2,
                y: ((event.clientY - rect.top) / rect.height - .5) * 2,
              });
            }}
          >
            <span className="flim-kicker">DATABASE</span>
            <h2>Find your<br />influences</h2>
            <p>Dive into the most complete visual library out there, curated to help you discover the references that shape your creative direction. <a href="https://flim.ai/" onClick={(event) => event.preventDefault()}>Learn more.</a></p>
            <div aria-hidden="true" className="flim-physics-stage">
              {PHYSICS_ITEMS.map((item, index) => <PhysicsItem index={index} item={item} key={`${item.kind}-${item.label ?? index}`} pointer={pointer} />)}
            </div>
            <SearchBar />
          </article>

          <article className="flim-platform-panel">
            <div className="flim-platform-panel__copy">
              <span className="flim-kicker">THE PLATFORM</span>
              <h2>Search Beautifully.<br />Create Purposefully.</h2>
              <p>For those who sketch with references, speak in moodboards, and shape ideas frame by frame.</p>
              <a href="https://flim.ai/pricing" onClick={(event) => event.preventDefault()}>LEARN ABOUT PRICING <span aria-hidden="true">→</span></a>
            </div>
            <div aria-hidden="true" className="flim-platform-panel__media">
              <img className="flim-platform-panel__header" src={headerUrl} />
              <img className="flim-platform-panel__screen" src={platformImageUrl} />
              <img className="flim-platform-panel__image" src={searchImageUrl} />
              <img className="flim-platform-panel__mobile" src={mobileImagesUrl} />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
