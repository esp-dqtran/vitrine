import { PersonaMedia } from "./primitives/PersonaMedia";

export function PersonaCard({ active = true, description, image, onSelect, title, useCases, video }) {
  return <button className="persona-card" onClick={onSelect} type="button">
    <PersonaMedia active={active} alt={title} src={video ?? image} type={video ? "video" : "image"} useCases={useCases} />
    <div className="persona-card__copy"><h3>{title}</h3><p>{description}</p></div>
  </button>;
}
