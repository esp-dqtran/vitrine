import { useEffect, useRef, useState } from 'react';

const IMAGE_LAYOUT = [
  { x: 9, y: 24, width: 118, ratio: 1.62 },
  { x: 50, y: 97, width: 151, ratio: 1.66 },
  { x: 93, y: 34, width: 165, ratio: 1 },
  { x: 37, y: 27, width: 55, ratio: 1.62 },
  { x: 90, y: 97, width: 51, ratio: .8 },
  { x: 75, y: 25, width: 57, ratio: 1.73 },
  { x: 17, y: 81, width: 165, ratio: 1.62 },
  { x: 76, y: 74, width: 102, ratio: 1 },
  { x: 26, y: 6, width: 80, ratio: 1 },
  { x: 56, y: 11, width: 157, ratio: 1 },
];

export function FlimHeroSearchSection({ groups, onSearch }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const activeGroup = groups[activeIndex] ?? groups[0];
  const imagesVisible = !focused && !query;

  useEffect(() => {
    if (focused || query || groups.length < 2) return undefined;
    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % groups.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [focused, groups.length, query]);

  useEffect(() => {
    const focusFromShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusFromShortcut);
    return () => window.removeEventListener('keydown', focusFromShortcut);
  }, []);

  const submit = (event) => {
    event.preventDefault();
    const value = query.trim() || activeGroup.term;
    if (onSearch) {
      onSearch(value);
      return;
    }
    window.open(`https://app.flim.ai/?ft=${encodeURIComponent(value)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="flim-component flim-hero-search" data-flim-component="hero-search">
      <div aria-hidden="true" className={`flim-hero-search__images${imagesVisible ? ' is-visible' : ''}`}>
        {groups.map((group, groupIndex) => (
          <div className={`flim-hero-search__image-group${groupIndex === activeIndex ? ' is-active' : ''}`} key={group.term}>
            {group.images.map((src, index) => {
              const layout = IMAGE_LAYOUT[index % IMAGE_LAYOUT.length];
              return (
                <img
                  alt=""
                  className="flim-hero-search__image"
                  key={src}
                  src={src}
                  style={{
                    '--flim-image-delay': `${index * 45}ms`,
                    '--flim-image-ratio': layout.ratio,
                    '--flim-image-width': `${layout.width}px`,
                    '--flim-image-x': `${layout.x}%`,
                    '--flim-image-y': `${layout.y}%`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <form className="flim-search-bar" onSubmit={submit}>
        <label className="flim-search-bar__field">
          <span className="flim-sr-only">Search Flim</span>
          {!focused && !query ? (
            <span aria-hidden="true" className="flim-search-bar__cycle" key={activeGroup.term}>
              {Array.from(activeGroup.term.toUpperCase()).map((character, index) => (
                <span key={`${character}-${index}`} style={{ '--flim-character-delay': `${index * 24}ms` }}>{character === ' ' ? '\u00a0' : character}</span>
              ))}
            </span>
          ) : null}
          <input
            aria-label="Search anything"
            onBlur={() => setFocused(false)}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={focused ? 'SEARCH ANYTHING' : ''}
            ref={inputRef}
            type="search"
            value={query}
          />
        </label>
        <button type="submit">SEARCH <span aria-hidden="true">⌘/</span></button>
      </form>
    </section>
  );
}
