import { Minus, Plus } from "../primitives/Icons";
import { ControlButton } from "../primitives/ControlButton";

export const SOURCE_ZOOM_LEVELS = [0.3, 0.5, 1];

export function ZoomControl({ index, onChange }) {
  return (
    <div className="zoom-control" aria-label="Canvas zoom">
      <ControlButton
        className="circle-control"
        icon={<Minus size={16} />}
        aria-label="Zoom out"
        disabled={index === 0}
        onClick={() => onChange(Math.max(0, index - 1))}
      />
      <ControlButton
        className="circle-control"
        icon={<Plus size={16} />}
        aria-label="Zoom in"
        disabled={index === SOURCE_ZOOM_LEVELS.length - 1}
        onClick={() => onChange(Math.min(SOURCE_ZOOM_LEVELS.length - 1, index + 1))}
      />
    </div>
  );
}
