import { Button } from '@astryxdesign/core';

export function GuestCatalogControls({ onLogin }: { onLogin: () => void }) {
  return (
    <div
      data-guest-catalog-controls="true"
      style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      <Button label="Login" variant="primary" size="sm" clickAction={onLogin} />
    </div>
  );
}
