import { Icon, IconButton } from '@astryxdesign/core';

export function PreviewModalCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <div
      data-public-preview-close="true"
      style={{ position: 'absolute', top: 16, right: 16, zIndex: 5 }}
    >
      <IconButton
        label="Close preview"
        icon={<Icon icon="close" size="sm" />}
        variant="ghost"
        className="astryx-modal__icon-action"
        onClick={onClose}
      />
    </div>
  );
}
