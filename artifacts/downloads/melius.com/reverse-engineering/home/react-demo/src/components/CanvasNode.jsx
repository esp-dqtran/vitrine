import { CanvasMediaFrame } from "./primitives/CanvasMediaFrame";
import { CanvasNodeCaption } from "./primitives/CanvasNodeCaption";
import { MeliusTag } from "./primitives/MeliusTag";

export function CanvasNode({ active = true, alt, aspectRatio, mediaType = "image", model, revealed = false, src, title, type }) {
  return <div className="canvas-node" data-state={revealed ? "shown" : "hidden"}><CanvasNodeCaption model={model} title={title} /><div className="canvas-node__body"><div className="canvas-node__tag"><MeliusTag>{type}</MeliusTag></div><div className="canvas-node__media-state"><CanvasMediaFrame alt={alt} aspectRatio={aspectRatio} play={active && revealed} src={src} type={mediaType} /></div></div></div>;
}
