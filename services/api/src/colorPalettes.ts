import type express from 'express';
import type { ColorPaletteStore } from '../../../src/colorPaletteStore.ts';

export function mountColorPaletteRoutes(app: express.Express, store: ColorPaletteStore): void {
  app.get('/color-palettes', async (_request, response, next) => {
    try {
      response.setHeader('Cache-Control', 'private, max-age=300');
      const [items, collections] = await Promise.all([
        store.list(),
        store.listCollections(),
      ]);
      response.json({ items, collections });
    } catch (error) {
      next(error);
    }
  });
}
