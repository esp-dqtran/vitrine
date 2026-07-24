import { Button } from '@astryxdesign/core';

export function GuestCatalogControls({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div
      data-guest-catalog-controls="true"
      style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
      }}
    >
      <Button label="Log in" variant="ghost" size="sm" clickAction={onSignIn} />
      <Button label="Get started" variant="primary" size="sm" clickAction={onSignIn} />
    </div>
  );
}
