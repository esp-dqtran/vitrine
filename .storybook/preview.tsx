import type { Preview } from '@storybook/react-vite';
import React, { useEffect } from 'react';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    docs: {
      toc: true,
    },
  },
  globalTypes: {
    theme: {
      description: 'Astryx color scheme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme ?? 'light';
      useEffect(() => {
        document.documentElement.setAttribute('data-astryx-theme', 'neutral');
        document.documentElement.style.colorScheme = theme;
      }, [theme]);
      return (
        <div
          style={{
            fontFamily: "'Figtree', system-ui, sans-serif",
            background: 'var(--color-background-body)',
            color: 'var(--color-text-primary)',
            minHeight: '100%',
            padding: 24,
          }}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
