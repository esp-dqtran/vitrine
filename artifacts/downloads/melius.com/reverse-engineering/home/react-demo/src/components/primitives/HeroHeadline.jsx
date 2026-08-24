export function HeroHeadline({ first, second, revealed = false }) {
  return <h1 className="hero-headline" data-state={revealed ? "open" : "closed"}><span>{first}</span><span>{second}</span></h1>;
}
