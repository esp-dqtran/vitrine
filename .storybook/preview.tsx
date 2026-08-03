import type { Preview } from '@storybook/react-vite';
import React, { useEffect } from 'react';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '../src/vitrine/uiFoundation.css';
import '../src/vitrine/productForms.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    docs: {
      toc: true,
    },
    options: {
      storySort: {
        order: [
          'Design System',
          'Foundations',
          'Actions',
          'Inputs',
          'Selection',
          'Content',
          'Layout',
          'Navigation',
          'Overlays',
          'Feedback',
          'DataDisplay',
          'Disclosure',
        ],
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Vitrines color scheme',
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
            fontFamily: 'var(--font-family-body)',
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
