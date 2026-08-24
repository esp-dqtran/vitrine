import type { QueryResultRow } from 'pg';
import type {
  ColorCollection,
  ColorCollectionFeaturedColor,
  ColorPalette,
  ColorPaletteKind,
  ColorPaletteRole,
} from './colorPalettes.ts';

export interface ColorPaletteStore {
  list(): Promise<ColorPalette[]>;
  listCollections(): Promise<ColorCollection[]>;
}

interface ColorPaletteRow extends QueryResultRow {
  palette_id: string;
  palette_name: string;
  mood: string;
  kind: ColorPaletteKind;
  color_id: string;
  color_name: string;
  hex: string;
  foreground: string;
  role: ColorPaletteRole;
  outlined: boolean;
  source_type: 'app' | 'site' | null;
  source_name: string | null;
  source_icon_url: string | null;
  gradient_angle: number | null;
  gradient_end_hex: string | null;
}

interface ColorCollectionRow extends QueryResultRow {
  id: string;
  name: string;
  description: string;
  year: number | null;
  featured_colors: ColorCollectionFeaturedColor[];
  palette_ids: string[];
}

export function createColorPaletteStore(
  query: <R extends QueryResultRow>(sql: string, params?: unknown[]) => Promise<{ rows: R[] }>,
): ColorPaletteStore {
  return {
    async list() {
      const result = await query<ColorPaletteRow>(
        `SELECT p.id AS palette_id, p.name AS palette_name, p.mood, p.kind,
                c.id AS color_id, c.name AS color_name, c.hex, c.foreground, c.role, c.outlined,
                CASE WHEN source_app.id IS NOT NULL THEN 'app'
                     WHEN source_site.id IS NOT NULL THEN 'site'
                     ELSE NULL END AS source_type,
                COALESCE(source_app.source_name, source_site.source_name) AS source_name,
                COALESCE(source_app.icon_url, source_site.icon_url) AS source_icon_url,
                c.gradient_angle, c.gradient_end_hex
         FROM color_palettes p
         JOIN color_palette_colors c ON c.palette_id = p.id
         LEFT JOIN LATERAL (
           SELECT app.id,
                  COALESCE(NULLIF(app.display_name, ''), app.name) AS source_name,
                  COALESCE(
                    CASE WHEN app.icon_object_key IS NOT NULL THEN '/assets/' || app.icon_object_key END,
                    app.icon_url
                  ) AS icon_url
           FROM apps app
           WHERE p.mood LIKE 'From Apps · %'
             AND COALESCE(NULLIF(app.display_name, ''), app.name)
               = split_part(split_part(p.mood, ' · ', 2), ' — ', 1)
           ORDER BY app.id
           LIMIT 1
         ) source_app ON TRUE
         LEFT JOIN LATERAL (
           SELECT site.id, site.name AS source_name,
                  COALESCE(
                    CASE WHEN site.icon_object_key IS NOT NULL THEN '/assets/' || site.icon_object_key END,
                    site.logo_url
                  ) AS icon_url
           FROM sites site
           WHERE p.mood LIKE 'From Sites · %'
             AND site.name = split_part(split_part(p.mood, ' · ', 2), ' — ', 1)
           ORDER BY site.id
           LIMIT 1
         ) source_site ON TRUE
         WHERE p.is_published = TRUE
         ORDER BY p.position, c.position`,
      );
      const palettes = new Map<string, ColorPalette>();
      for (const row of result.rows) {
        let palette = palettes.get(row.palette_id);
        if (!palette) {
          palette = {
            id: row.palette_id,
            name: row.palette_name,
            mood: row.mood,
            kind: row.kind ?? 'solid',
            ...(row.source_type && row.source_name ? {
              source: {
                type: row.source_type,
                name: row.source_name,
                ...(row.source_icon_url ? { iconUrl: row.source_icon_url } : {}),
              },
            } : {}),
            cards: [],
          };
          palettes.set(row.palette_id, palette);
        }
        (palette.cards as Array<ColorPalette['cards'][number]>).push({
          id: row.color_id,
          name: row.color_name,
          hex: row.hex,
          color: row.gradient_angle !== null && row.gradient_angle !== undefined && row.gradient_end_hex
            ? `linear-gradient(${row.gradient_angle}deg, ${row.hex} 0%, ${row.gradient_end_hex} 100%)`
            : row.hex,
          foreground: row.foreground,
          role: row.role,
          ...(row.gradient_angle !== null && row.gradient_angle !== undefined && row.gradient_end_hex
            ? { gradient: { angle: row.gradient_angle, endHex: row.gradient_end_hex } }
            : {}),
          ...(row.outlined ? { outlined: true } : {}),
        });
      }
      return [...palettes.values()].filter((palette) => palette.cards.length === 3);
    },
    async listCollections() {
      const result = await query<ColorCollectionRow>(
        `SELECT collection.id, collection.name, collection.description, collection.year,
                collection.featured_colors,
                COALESCE(
                  array_agg(membership.palette_id ORDER BY membership.position)
                    FILTER (WHERE palette.id IS NOT NULL),
                  ARRAY[]::TEXT[]
                ) AS palette_ids
         FROM color_collections collection
         LEFT JOIN color_collection_palettes membership
           ON membership.collection_id = collection.id
         LEFT JOIN color_palettes palette
           ON palette.id = membership.palette_id AND palette.is_published = TRUE
         WHERE collection.is_published = TRUE
         GROUP BY collection.id
         ORDER BY collection.position`,
      );
      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        year: row.year ?? 0,
        featuredColors: row.featured_colors,
        paletteIds: row.palette_ids,
      }));
    },
  };
}
