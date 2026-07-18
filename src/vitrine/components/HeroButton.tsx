import { Button } from '@astryxdesign/core';

interface HeroButtonProps {
  primary?: boolean;
  onClick?: () => void;
  children: string;
}

export function HeroButton({ primary, onClick, children }: HeroButtonProps) {
  return (
    <Button
      label={children}
      variant={primary ? 'primary' : 'secondary'}
      onClick={onClick}
      style={{
        borderRadius: 999,
        paddingInline: 22,
      }}
    />
  );
}
