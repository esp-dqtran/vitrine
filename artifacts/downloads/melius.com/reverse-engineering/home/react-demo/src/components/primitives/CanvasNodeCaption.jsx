export function CanvasNodeCaption({ title, model }) {
  return <div className="canvas-node-caption"><span>{title}</span><span className="canvas-node-caption__model">{model}</span></div>;
}
