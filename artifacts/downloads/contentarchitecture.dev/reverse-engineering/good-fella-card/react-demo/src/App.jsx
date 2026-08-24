import { ShowcaseCard } from "./components/ShowcaseCard.jsx";

export function App() {
  return (
    <main className="demo-shell">
      <ShowcaseCard
        className="demo-card"
        href="https://www.serverobotics.com/"
        imageAlt="Serve Robotics website built on The Content Architecture"
        imageSrc="/assets/serve-robotics.avif"
        title="Serve Robotics"
      />
    </main>
  );
}
