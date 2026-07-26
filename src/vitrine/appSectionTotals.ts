import type { AppVersion } from '../db.ts';
import type { AppMetadata } from './types.ts';

type AppTotalSource = Pick<AppMetadata, 'totalScreens' | 'totalUiElements' | 'totalFlows'>;
type VersionTotalSource = Pick<
  AppVersion,
  'version_number' | 'screen_count' | 'ui_element_count' | 'flow_count'
>;

export function resolveAppSectionTotals(
  app: AppTotalSource,
  versions: VersionTotalSource[] | null,
  selectedVersion?: number,
) {
  const version = selectedVersion === undefined
    ? undefined
    : versions?.find(({ version_number }) => version_number === selectedVersion);

  return {
    screens: version?.screen_count ?? app.totalScreens,
    elements: version?.ui_element_count ?? app.totalUiElements,
    flows: version?.flow_count ?? app.totalFlows,
  };
}
