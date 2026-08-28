import { FilterControl } from "../composites/FilterControl";
import { MenuControl } from "../composites/MenuControl";

export function ControlDockSection({ menu, filters }) {
  return (
    <div className="control-dock">
      <MenuControl {...menu} />
      <FilterControl {...filters} />
    </div>
  );
}
