export function HeroDescription({ children }) {
  const lines = String(children).split("\n");
  return <div className="hero-description"><p>{lines.map((line, index) => <span key={`${line}-${index}`}>{index > 0 ? <br /> : null}{line}</span>)}</p></div>;
}
